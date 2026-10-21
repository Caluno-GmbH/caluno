# Email delivery outbox

Date: 2026-10-21
Status: Implemented

## Problem

Email delivery used to happen inline: a call-out or scheduler tick called
Scaleway and retried in-process. A provider timeout lost the email, and a burst
of sends produced a retry storm.

## Components

```mermaid
flowchart TB
  subgraph Callers
    CO[ShiftCallOutService]
    US[ShiftUnderstaffedNotificationService]
    IR[ShiftInviteReminderService]
    DG[VolunteerDigestService]
    OS[OrganizationUnitService]
    NS[NotificationService]
    AU[BetterAuth auth flows]
  end

  ES[EmailService facade]
  OB[EmailOutboxService]
  DB[(email_outbox)]
  WK[EmailOutboxWorkerService<br/>cron every 10s]
  TR[EmailTransportService]
  SMTP[SMTP / Mailpit]
  TEM[Scaleway TEM API]

  CO --> OB
  US --> OB
  IR --> OB
  DG --> OB
  OS --> OB
  NS -->|send| ES
  AU -->|sendImmediately| ES
  ES -->|send| OB
  ES -->|sendImmediately| OB
  OB -->|enqueue / claim / update| DB
  WK -->|drain| OB
  OB -->|sendOnce| TR
  TR -->|SMTP| SMTP
  TR -->|HTTPS| TEM
```

- **`EmailService`** is the only entry point for `NotificationService` and auth
  mail. `send()` enqueues; `sendImmediately()` enqueues and tries once now.
- **`EmailOutboxService`** owns the durable email record, claiming,
  backoff and expiry.
- **`EmailOutboxWorkerService`** drains due emails every 10 seconds.
- **`EmailTransportService`** performs exactly one provider attempt and returns
  a retryable/non-retryable result.
- **`email_outbox`** stores the rendered payload, so retries are byte-identical.

## Send path

```mermaid
sequenceDiagram
  autonumber
  participant C as Caller
  participant O as EmailOutboxService
  participant D as email_outbox
  participant W as Worker 10s
  participant T as Transport
  participant P as Provider / Mailpit

  C->>O: enqueue({ category, to, subject, html, expiresAt })
  O->>D: INSERT
  D-->>O: outbox email (PENDING)
  O-->>C: outbox email

  Note over W: Every 10 seconds
  W->>O: drain()
  O->>D: reclaim stale SENDING emails (10 min)
  O->>D: claim due PENDING emails (FOR UPDATE SKIP LOCKED)
  D-->>O: claimed emails (SENDING, attempts + 1)
  O->>T: sendOnce(email)
  T->>P: SMTP or TEM
  alt Provider accepted
    P-->>T: 2xx / message id
    T-->>O: { ok: true }
    O->>D: UPDATE status = SENT
  else Retryable failure
    P-->>T: timeout / 429 / 5xx
    T-->>O: { ok: false, retryable: true }
    O->>D: UPDATE status = PENDING, next_attempt_at = now() + backoff
  else Permanent or attempts exhausted
    P-->>T: 4xx / max attempts
    T-->>O: { ok: false, retryable: false }
    O->>D: UPDATE status = FAILED
  end
```

## Domain audit rows

Call-outs and understaffed manager notifications write their own per-recipient
rows. Those rows record who was asked or notified, when, and by whom; they have
no delivery status and the outbox does not update them. Their legacy `status`
column is nullable and no longer written; it is dropped in a follow-up release
so the previous release keeps working during the deploy.

The other senders — digest, invite reminder, the “nobody left to ask” fallback,
auth mail and support mail — have no audit row.

## Auth mail

```mermaid
sequenceDiagram
  participant B as BetterAuth
  participant E as EmailService
  participant O as EmailOutboxService
  participant D as email_outbox
  participant T as Transport
  participant W as Worker

  B->>E: sendImmediately(email, { expiresAt })
  E->>O: enqueueAndDeliver({ category: AUTH, ... })
  O->>D: INSERT PENDING
  O->>D: claim email (SENDING)
  O->>T: sendOnce()
  alt Success
    T-->>O: ok
    O->>D: SENT
  else Retryable
    O->>D: PENDING + backoff
    Note over W: Worker retries later
  else Permanent
    O->>D: FAILED
    O-->>E: error
    E-->>B: throw
  end
```

Password reset expires after 1 hour; OTP expires after 5 minutes.

## Status machine

```mermaid
stateDiagram-v2
  [*] --> PENDING: enqueue
  PENDING --> SENDING: claim (due, SKIP LOCKED)
  SENDING --> SENT: provider accepted
  SENDING --> PENDING: retryable failure<br/>attempts below max, backoff
  SENDING --> FAILED: non-retryable failure<br/>or attempts exhausted
  SENDING --> CANCELLED: expiresAt <= now
  SENDING --> PENDING: stale reclaim after 10 min
  SENT --> [*]
  FAILED --> [*]
  CANCELLED --> [*]
```

`SENT` means the provider accepted the message, not that the mailbox received
it. `deliveredAt` is reserved for TEM delivery webhooks.

## Retention

Entering `SENT`, `FAILED` or `CANCELLED` clears `html`, `text_body` and
`attachments`, so OTPs, reset links and check-in PDFs are not kept once
delivery is settled. Recipient, subject and status remain for troubleshooting.
A daily job at 03:00 (Europe/Berlin) deletes final emails not updated for 30 days.

## Failure handling

```mermaid
flowchart TD
  R[Transport result] --> OK{Accepted?}
  OK -->|yes| SENT[Mark SENT]
  OK -->|no| KIND{Retryable?}
  KIND -->|network / timeout / 429 / 5xx<br/>SMTP 4xx| ATT{attempts >= maxAttempts?}
  KIND -->|other 4xx<br/>SMTP 5xx| FAILED[Mark FAILED]
  ATT -->|no| RETRY[Mark PENDING<br/>next_attempt_at = now + backoff]
  ATT -->|yes| FAILED
  RETRY --> WAIT[Worker claims when due]
  WAIT --> R
  EXP[expiresAt reached] --> CANCELLED[Mark CANCELLED]
  MISS[Content missing at claim] --> FAILED
```

Backoff ladder: 1 min, 5 min, 15 min, 1 h, 4 h, 12 h, 24 h, with ±20% jitter.
An email that keeps throwing before the transport is capped at the next claim.

## Expiry and duplicate protection

| Caller | Category | Expiry |
|---|---|---|
| Call-out | `CALL_OUT` | `actualEndsAt` |
| No recipients | `CALL_OUT_NO_RECIPIENTS` | `actualEndsAt` |
| Manager notification | `MANAGER_NOTIFICATION` | `actualEndsAt` |
| Digest | `DIGEST` | Next day |
| Invite reminder | `INVITE_REMINDER` | `actualEndsAt` |
| Notifications | `NOTIFICATION` | None |
| Support | `SUPPORT` | None |
| Auth | `AUTH` | OTP 5 min / reset 1 h |

The outbox has no dedupe key; callers prevent duplicate sends themselves:

- **Invite reminder:** one transaction stamps `remindedAt` (only while it is
  still empty) and queues the email, so a crash or a concurrent click cannot
  queue a second reminder.
- **Digest:** `claimRun` allows one run per unit per day.
- **Understaffed tick:** the advisory lock and its fired-at state.
- **Manual call-outs, notifications, support and auth:** no protection; a
  retried request sends again. Auth resends are intentional (a new code).

`enqueue` accepts an optional transaction so a caller can commit the email
together with its own writes.

## Operational constants

| Setting | Value |
|---|---|
| Worker tick | 10 s |
| Claim batch | 20 emails |
| Send concurrency | 3 |
| Max emails per drain | 200 |
| Drain time budget | 60 s |
| Max attempts | 8 |
| Stale `SENDING` reclaim | 10 min |
| Provider timeout | 20 s |
| Final email retention | 30 days |

## Local verification

With Mailpit running (`bun run db:up`), unset `TEM_SECRET_KEY` and use:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
```

Mailpit UI: <http://localhost:8025>.

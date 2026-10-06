# Admin approval users: roster or waitlist (VOLI-1455)

Date: 2026-10-06 · Ticket: [VOLI-1455](https://holi.atlassian.net/browse/VOLI-1455) · Status: implemented

## Summary

A volunteer in `AWAITING_ADMIN_APPROVAL` has asked to work a shift and is waiting for a coordinator. Approving them admits them to the roster when a seat is free, and places them on the waitlist when the instance is already full. Rejecting them always removes the request. The coordinator sees which of those outcomes the click will produce before they confirm it.

The server already resolves the outcome. This spec changes the shift-instance volunteer list so the button and the status menu name that outcome up front. The mutation payload stays `JOINED`; `resolveAdminApprovalTargetStatus` remains the only decider.

## Decisions

1. **The server owns the outcome.** An admin approve of `AWAITING_ADMIN_APPROVAL` still sends `ShiftInviteStatus.JOINED`. `ShiftService.updateShiftInstanceInviteStatus` keeps calling `resolveAdminApprovalTargetStatus`. A seat means `JOINED`. A full capped instance means `WAITLIST_JOINED`. The client labels the action from the capacity it already has; it does not send `WAITLIST_JOINED` itself. A stale client that thinks a seat is free still waitlists when the server finds the instance full.
2. **A seat is a `JOINED` invite under the cap.** `filledCount` counts `PARTICIPATING_SHIFT_INVITE_STATUSES` (`JOINED` only). `maxVolunteers` null means unlimited, so approval always joins. `filledCount < maxVolunteers` joins. `filledCount >= maxVolunteers` waitlists.
3. **Reject ignores capacity.** `ADMIN_REJECTED` from `AWAITING_ADMIN_APPROVAL` succeeds for a coordinator with `SHIFT_EDIT` whether or not the instance is full. The volunteer list keeps offering Reject next to the approval action.
4. **The preview can lose a race; the toast tells the truth.** Two coordinators can approve the last seat. The second lands on the waitlist. The existing `approveWaitlistedSuccess` toast stays the confirmation when the returned status is `WAITLIST_JOINED`.
5. **Volunteers cannot approve themselves.** `AWAITING_ADMIN_APPROVAL` → `JOINED` stays forbidden for a non-privileged actor (`volunteerMayRequestInviteStatus`).
6. **Events are unchanged.** Event approval has no capacity. `resolveAdminApprovalTargetStatus({ hasAvailableSeat: true, allowWaitlist: false })` always yields `JOINED`.
7. **Pause-approval is unchanged.** The hourly sweep and “turn approval off” already admit the oldest `AWAITING_ADMIN_APPROVAL` invites up to capacity and waitlist the rest (`autoResolveAwaitingApprovalInvites`). This spec does not change that sweep.

## Current behavior

`ShiftInstanceVolunteersPanel` treats every `AWAITING_ADMIN_APPROVAL` row the same way:

- `adminRowActions` returns `['Approve']`.
- `adminChipTargetStatuses` returns `[JOINED, ADMIN_REJECTED]`.
- The chip labels `JOINED` as “Accepted” (`inviteStatus.accepted`).
- `onAction('Approve')` calls `applyStatus(invite, ShiftInviteStatus.Joined)`.

`applyStatus` already branches on the response: `WAITLIST_JOINED` shows `inviteStatus.approveWaitlistedSuccess` (“Assignment is full. Volunteer added to the waitlist.” / “Der Einsatz ist voll besetzt. Freiwillige:r steht jetzt auf der Warteliste.”). `JOINED` shows `inviteStatus.approveSuccess`. The coordinator learns the destination only after the click. That is the gap in VOLI-1455.

The panel already receives `filledCount` and `maxVolunteers`, which are the same numbers the capacity badge uses.

## Target behavior

For a row whose invite status is `AWAITING_ADMIN_APPROVAL`, and only that status:

| Instance capacity | Button | Status-menu option that admits them | Value sent | Server result |
| --- | --- | --- | --- | --- |
| Unlimited, or `filledCount < maxVolunteers` | Approve / Genehmigen | Accepted / Angenommen | `JOINED` | `JOINED`, approval email |
| `maxVolunteers` set and `filledCount >= maxVolunteers` | Approve to waitlist / Auf die Warteliste setzen | Waitlist / Warteliste | `JOINED` | `WAITLIST_JOINED`, waitlist email |

Reject stays on the status menu in both rows and still sends `ADMIN_REJECTED`.

Other statuses keep today’s actions. A `WAITLIST_JOINED` row still offers Joined and Rejected; promoting a waitlisted volunteer is a different action and is not relabelled here.

## Frontend

### Capacity helper

Add a pure helper next to the invite-status display helpers, covered by `invite-status-display.spec.ts`:

```ts
export function approvalAdmitsToWaitlist(
  filledCount: number,
  maxVolunteers: number | null | undefined,
): boolean {
  return maxVolunteers != null && filledCount >= maxVolunteers;
}
```

`null` and `undefined` max both mean unlimited.

### Row actions

`adminRowActions` stays status-only and keeps returning `['Approve']` for `AWAITING_ADMIN_APPROVAL`. The visible label is chosen in the panel, because capacity is instance data and the helper is shared with event rows that have no cap.

In `ShiftInstanceVolunteersPanel`, when the row is `AWAITING_ADMIN_APPROVAL` and `approvalAdmitsToWaitlist(filledCount, maxVolunteers)` is true, set that row’s `actionLabels.Approve` to a new key `Shift.inviteStatus.actionApproveToWaitlist`.

Copy:

- en: `Approve to waitlist`
- de: `Auf die Warteliste setzen`

Every other Approve row keeps `Shift.inviteStatus.actionApprove` (`Approve` / `Genehmigen`), including the list-level `actionLabels` passed to `VolunteeringVolunteerList`. Per-row `actionLabels` already override the list labels for Remind; Approve follows the same override.

`onAction('Approve')` still calls `applyStatus(invite, ShiftInviteStatus.Joined)`.

### Status menu

`adminChipTargetStatuses(AwaitingAdminApproval)` stays `[JOINED, ADMIN_REJECTED]`.

`chipOptionLabel` in the panel, for a target of `JOINED` on an `AWAITING_ADMIN_APPROVAL` row that `approvalAdmitsToWaitlist` says is full:

- label: `Shift.inviteStatus.waitlisted` (`Waitlist` / `Warteliste`)
- `state`: `'waitlisted'`

The option `value` stays `ShiftInviteStatus.Joined`. `onStatusChange` still forwards that value, so the server resolves it. The chip icon and words describe the waitlist outcome.

When a seat is free, the same option keeps label `inviteStatus.accepted` and state `toInviteDisplayState(JOINED)` (`accepted`).

### Toasts

Leave `approveSuccess` and `approveWaitlistedSuccess` as they are. They confirm the status the mutation returned, including the race where the preview said “Approve” and the response is `WAITLIST_JOINED`.

## Backend

No service, resolver, or schema change.

These paths already implement the contract and stay as they are:

- `resolveAdminApprovalTargetStatus` in `apps/backend/src/shared/invite-status.ts`
- The privileged `AWAITING_ADMIN_APPROVAL` + requested `JOINED` branch in `ShiftService.updateShiftInstanceInviteStatus` and `updateShiftInviteStatus`
- Approval email on `JOINED`, waitlist email on `WAITLIST_JOINED`
- `ForbiddenGraphQLError` when a volunteer requests `JOINED` from `AWAITING_ADMIN_APPROVAL`

## Testing

Frontend unit tests (`bun test` on `apps/frontend/src/domain/shift/invite-status-display.spec.ts`):

- `approvalAdmitsToWaitlist(1, 2)` is false
- `approvalAdmitsToWaitlist(2, 2)` is true
- `approvalAdmitsToWaitlist(3, null)` and `approvalAdmitsToWaitlist(3, undefined)` are false
- `adminRowActions(AwaitingAdminApproval)` is still `['Approve']`
- `adminChipTargetStatuses(AwaitingAdminApproval)` is still `[JOINED, ADMIN_REJECTED]`

Existing backend coverage already locks the resolution. Do not edit those tests to change the contract:

- `apps/backend/test/shift.integration.spec.ts` — volunteer cannot self-approve `AWAITING_ADMIN_APPROVAL` to `JOINED`
- `apps/backend/test/shift-instance-approval.integration.spec.ts` — turning approval off admits oldest pending requests up to capacity and waitlists the overflow
- `apps/backend/src/shift/shift.join-request-emails.spec.ts` — approval of a pending request emails the volunteer; a lost race for the last seat emails the waitlist notice

Manual check on a shift instance with `joinRequiresApproval` and `maxVolunteers: 1`:

- One pending applicant, zero joined: the button reads Approve and the menu option reads Accepted. Confirming joins them and shows “Volunteer approved”.
- A second pending applicant after that seat is taken: the button reads Approve to waitlist and the menu option reads Waitlist. Confirming waitlists them and shows the full-assignment toast.
- Reject on that second applicant sets `ADMIN_REJECTED` and shows the remove toast.
- An uncapped approval shift keeps Approve / Accepted for every pending applicant.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../../database/database.module';
import { DATABASE_CONNECTION } from '../../../database/database-connection';
import * as schema from '../../../database/schema';
import type {
  EmailOutboxEntity,
  StoredEmailAttachment,
} from '../../schemas/email-outbox.schema';
import {
  type EmailAttachment,
  type EmailSendResult,
  EmailTransportService,
} from '../email-transport.service';
import { computeNextAttemptDelayMs } from './email-outbox.backoff';
import { EmailCategory, EmailDeliveryStatus } from './email-outbox.enums';

export interface EnqueueEmailInput {
  category: EmailCategory;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  userId?: string | null;
  organizationUnitId?: string | null;
  /** Idempotency key: a re-run of the same business action reuses the row. */
  dedupeKey?: string | null;
  /** After this instant the email is no longer useful and is cancelled. */
  expiresAt?: Date | null;
  maxAttempts?: number;
}

export interface EmailDeliveryOutcome {
  row: EmailOutboxEntity;
  result: EmailSendResult;
}

export interface DrainSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
  /** Rows whose processing threw; they stay SENDING for the stale reclaim. */
  errored: number;
}

const MAX_ATTEMPTS_DEFAULT = 8;
const BATCH_SIZE = 20;
const SEND_CONCURRENCY = 3;
const MAX_PER_RUN = 200;
const STALE_SENDING_MS = 10 * 60 * 1000;
const RUN_BUDGET_MS = 60 * 1000;

function serializeAttachments(
  attachments: EmailAttachment[] | undefined,
): StoredEmailAttachment[] | null {
  if (!attachments?.length) return null;
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    ...(attachment.cid ? { cid: attachment.cid } : {}),
    content: attachment.content.toString('base64'),
  }));
}

function deserializeAttachments(
  attachments: StoredEmailAttachment[] | null,
): EmailAttachment[] | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    ...(attachment.cid ? { cid: attachment.cid } : {}),
    content: Buffer.from(attachment.content, 'base64'),
  }));
}

function summarizeError(message: string, maxLength = 500): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength)}…`
    : collapsed;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await mapper(items[index] as T);
      }
    }),
  );

  return results;
}

@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly transport: EmailTransportService,
  ) {}

  /**
   * Persist an email for later delivery. Returns the existing row when
   * `dedupeKey` already exists.
   */
  async enqueue(input: EnqueueEmailInput): Promise<EmailOutboxEntity> {
    const [inserted] = await this.db
      .insert(schema.emailOutbox)
      .values({
        dedupeKey: input.dedupeKey ?? null,
        category: input.category,
        userId: input.userId ?? null,
        recipientEmail: input.to,
        subject: input.subject,
        html: input.html,
        textBody: input.text ?? null,
        attachments: serializeAttachments(input.attachments),
        organizationUnitId: input.organizationUnitId ?? null,
        maxAttempts: input.maxAttempts ?? MAX_ATTEMPTS_DEFAULT,
        expiresAt: input.expiresAt ?? null,
      })
      .onConflictDoNothing({ target: schema.emailOutbox.dedupeKey })
      .returning();

    if (inserted) return inserted;

    if (!input.dedupeKey) {
      throw new Error('Email outbox insert returned no row');
    }

    const [existing] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.dedupeKey, input.dedupeKey))
      .limit(1);

    if (!existing) {
      throw new Error(
        `Email outbox dedupe key ${input.dedupeKey} conflicted but no row was found`,
      );
    }
    return existing;
  }

  /** Enqueue and attempt once now; retryable failures remain queued. */
  async enqueueAndDeliver(
    input: EnqueueEmailInput,
  ): Promise<EmailDeliveryOutcome> {
    const enqueued = await this.enqueue(input);

    if (enqueued.status === EmailDeliveryStatus.SENT) {
      return {
        row: enqueued,
        result: {
          ok: true,
          providerMessageId: enqueued.providerMessageId,
        },
      };
    }
    if (enqueued.status !== EmailDeliveryStatus.PENDING) {
      return {
        row: enqueued,
        result: {
          ok: false,
          retryable: false,
          error: new Error(
            `Email ${enqueued.id} is not deliverable (status ${enqueued.status})`,
          ),
        },
      };
    }

    const claimed = await this.claimById(enqueued.id);
    if (!claimed) {
      return {
        row: enqueued,
        result: {
          ok: false,
          retryable: true,
          error: new Error(`Email ${enqueued.id} is already being sent`),
        },
      };
    }

    const { result } = await this.deliverRow(claimed);
    const row = (await this.findById(claimed.id)) ?? claimed;
    return { row, result };
  }

  /**
   * Drain due messages. Safe to call from every replica: claiming uses
   * `FOR UPDATE SKIP LOCKED`, so two workers never pick the same row.
   */
  async drain(): Promise<DrainSummary> {
    const summary: DrainSummary = {
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      cancelled: 0,
      errored: 0,
    };

    await this.reclaimStaleSending();
    const startedAt = Date.now();

    while (
      summary.claimed < MAX_PER_RUN &&
      Date.now() - startedAt < RUN_BUDGET_MS
    ) {
      const batch = await this.claimBatch(BATCH_SIZE);
      if (batch.length === 0) break;

      summary.claimed += batch.length;
      const outcomes = await mapWithConcurrency(
        batch,
        SEND_CONCURRENCY,
        async (row) => {
          try {
            return (await this.deliverRow(row)).outcome;
          } catch (error) {
            // Leave the row in SENDING for the stale reclaim; one bad row must
            // not abort the rest of the batch.
            this.logger.error(
              {
                event: 'email_outbox.delivery_error',
                email_id: row.id,
                category: row.category,
                err: error,
              },
              'Failed to process an outbox row; it will be reclaimed',
            );
            return 'errored';
          }
        },
      );
      for (const outcome of outcomes) {
        summary[outcome] += 1;
      }
    }

    return summary;
  }

  private async findById(id: string): Promise<EmailOutboxEntity | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.id, id))
      .limit(1);
    return row;
  }

  private async claimById(id: string): Promise<EmailOutboxEntity | undefined> {
    const [claimed] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.SENDING,
        attempts: sql`${schema.emailOutbox.attempts} + 1`,
        // DB clock: avoids a client/session timezone skew in stale reclaim.
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.emailOutbox.id, id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.PENDING),
        ),
      )
      .returning();
    return claimed;
  }

  private async claimBatch(limit: number): Promise<EmailOutboxEntity[]> {
    // Raw SQL because the claim must be a single atomic statement; a
    // SELECT-then-UPDATE pair would race across replicas.
    const claimed = (await this.db.execute(sql`
      UPDATE email_outbox
      SET status = 'SENDING', attempts = attempts + 1, updated_at = now()
      WHERE id IN (
        SELECT id
        FROM email_outbox
        WHERE status = 'PENDING' AND next_attempt_at <= now()
        ORDER BY next_attempt_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };

    const ids = (claimed.rows ?? []).map((row) => row.id);
    if (ids.length === 0) return [];

    const rows = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(inArray(schema.emailOutbox.id, ids));

    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is EmailOutboxEntity => row !== undefined);
  }

  private async reclaimStaleSending(): Promise<void> {
    const result = (await this.db.execute(sql`
      UPDATE email_outbox
      SET status = 'PENDING', next_attempt_at = now(), updated_at = now()
      WHERE status = 'SENDING'
        AND updated_at < now() - (${STALE_SENDING_MS} * interval '1 millisecond')
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };

    if (result.rows?.length) {
      this.logger.warn(
        {
          event: 'email_outbox.reclaimed_stale',
          count: result.rows.length,
        },
        'Reclaimed emails stuck in SENDING',
      );
    }
  }

  private async deliverRow(row: EmailOutboxEntity): Promise<{
    outcome: 'sent' | 'retried' | 'failed' | 'cancelled';
    result: EmailSendResult;
  }> {
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      await this.markCancelled(row);
      return {
        outcome: 'cancelled',
        result: {
          ok: false,
          retryable: false,
          error: new Error('Email expired before delivery'),
        },
      };
    }

    // A row that keeps throwing before the transport never reaches the
    // transport-failure branch, so cap it here on the next claim.
    if (row.attempts > row.maxAttempts) {
      const error = new Error('Maximum delivery attempts exceeded');
      await this.markFailed(row, error);
      return {
        outcome: 'failed',
        result: { ok: false, retryable: false, error },
      };
    }

    const result = await this.transport.sendOnce({
      to: row.recipientEmail,
      subject: row.subject,
      html: row.html,
      text: row.textBody ?? undefined,
      attachments: deserializeAttachments(row.attachments),
      userId: row.userId ?? undefined,
      emailId: row.id,
    });

    if (result.ok) {
      await this.markSent(row, result.providerMessageId);
      return { outcome: 'sent', result };
    }

    if (!result.retryable || row.attempts >= row.maxAttempts) {
      await this.markFailed(row, result.error);
      return { outcome: 'failed', result };
    }

    await this.markRetry(row, result.error);
    return { outcome: 'retried', result };
  }

  private async markSent(
    row: EmailOutboxEntity,
    providerMessageId: string | null,
  ): Promise<void> {
    const [updated] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.SENT,
        sentAt: new Date(),
        providerMessageId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, row.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, row.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updated) {
      this.logStaleTransition(row, EmailDeliveryStatus.SENT);
      return;
    }
  }

  private async markRetry(row: EmailOutboxEntity, error: Error): Promise<void> {
    const delayMs = computeNextAttemptDelayMs(row.attempts);

    const [updated] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.PENDING,
        // DB clock, matching the claim's `now()`.
        nextAttemptAt: sql`now() + (${delayMs} * interval '1 millisecond')`,
        lastError: summarizeError(error.message),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, row.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, row.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updated) {
      this.logStaleTransition(row, EmailDeliveryStatus.PENDING);
      return;
    }

    this.logger.warn(
      {
        event: 'email_outbox.retry_scheduled',
        email_id: row.id,
        category: row.category,
        attempt: row.attempts,
        max_attempts: row.maxAttempts,
        delay_ms: delayMs,
        err: error.message,
      },
      'Email delivery failed; retry scheduled',
    );
  }

  private async markFailed(
    row: EmailOutboxEntity,
    error: Error,
  ): Promise<void> {
    const [updated] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.FAILED,
        lastError: summarizeError(error.message),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, row.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, row.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updated) {
      this.logStaleTransition(row, EmailDeliveryStatus.FAILED);
      return;
    }

    this.logger.error(
      {
        event: 'email_outbox.failed',
        email_id: row.id,
        category: row.category,
        attempts: row.attempts,
        err: error.message,
      },
      'Email delivery failed permanently',
    );
  }

  private async markCancelled(row: EmailOutboxEntity): Promise<void> {
    const [updated] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.CANCELLED,
        lastError: 'Expired before delivery',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, row.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, row.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updated) {
      this.logStaleTransition(row, EmailDeliveryStatus.CANCELLED);
      return;
    }

    this.logger.warn(
      {
        event: 'email_outbox.cancelled',
        email_id: row.id,
        category: row.category,
        expires_at: row.expiresAt?.toISOString(),
      },
      'Email expired before it could be delivered',
    );
  }

  private logStaleTransition(
    row: EmailOutboxEntity,
    target: EmailDeliveryStatus,
  ): void {
    this.logger.warn(
      {
        event: 'email_outbox.transition_skipped',
        email_id: row.id,
        target,
      },
      'Outbox row is no longer SENDING; ignoring late transition',
    );
  }
}

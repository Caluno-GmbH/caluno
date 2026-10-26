import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
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
  expiresAt?: Date | null;
  maxAttempts?: number;
}

export interface EmailDeliveryOutcome {
  outboxEmail: EmailOutboxEntity;
  result: EmailSendResult;
}

export interface DrainSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
  errored: number;
}

const MAX_ATTEMPTS_DEFAULT = 8;
const BATCH_SIZE = 20;
const SEND_CONCURRENCY = 3;
const MAX_PER_RUN = 200;
const STALE_SENDING_MS = 10 * 60 * 1000;
const RUN_BUDGET_MS = 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES = [
  EmailDeliveryStatus.SENT,
  EmailDeliveryStatus.FAILED,
  EmailDeliveryStatus.CANCELLED,
];

const CLEARED_CONTENT = {
  html: null,
  textBody: null,
  attachments: null,
};

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
  values: T[],
  concurrency: number,
  mapValue: (value: T) => Promise<R>,
): Promise<R[]> {
  const mappedResults = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), values.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex++;
        if (index >= values.length) return;
        mappedResults[index] = await mapValue(values[index] as T);
      }
    }),
  );

  return mappedResults;
}

@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly transport: EmailTransportService,
  ) {}

  async enqueue(
    email: EnqueueEmailInput,
    tx: Database = this.db,
  ): Promise<EmailOutboxEntity> {
    const [insertedEmail] = await tx
      .insert(schema.emailOutbox)
      .values({
        category: email.category,
        userId: email.userId ?? null,
        recipientEmail: email.to,
        subject: email.subject,
        html: email.html,
        textBody: email.text ?? null,
        attachments: serializeAttachments(email.attachments),
        organizationUnitId: email.organizationUnitId ?? null,
        maxAttempts: email.maxAttempts ?? MAX_ATTEMPTS_DEFAULT,
        expiresAt: email.expiresAt ?? null,
      })
      .returning();

    if (!insertedEmail) {
      throw new Error('Email outbox insert returned no email');
    }
    return insertedEmail;
  }

  async enqueueAndDeliver(
    email: EnqueueEmailInput,
  ): Promise<EmailDeliveryOutcome> {
    const enqueuedEmail = await this.enqueue(email);

    const claimedEmail = await this.claimOutboxEmailById(enqueuedEmail.id);
    if (!claimedEmail) {
      return {
        outboxEmail: enqueuedEmail,
        result: {
          ok: false,
          retryable: true,
          error: new Error(`Email ${enqueuedEmail.id} is already being sent`),
        },
      };
    }

    const { result: deliveryResult } =
      await this.deliverOutboxEmail(claimedEmail);
    const refreshedEmail =
      (await this.findOutboxEmailById(claimedEmail.id)) ?? claimedEmail;
    return { outboxEmail: refreshedEmail, result: deliveryResult };
  }

  async drain(): Promise<DrainSummary> {
    const drainSummary: DrainSummary = {
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      cancelled: 0,
      errored: 0,
    };

    await this.reclaimStaleSending();
    const drainStartedAt = Date.now();

    while (
      drainSummary.claimed < MAX_PER_RUN &&
      Date.now() - drainStartedAt < RUN_BUDGET_MS
    ) {
      const claimedEmails = await this.claimOutboxEmailBatch(BATCH_SIZE);
      if (claimedEmails.length === 0) break;

      drainSummary.claimed += claimedEmails.length;
      const deliveryOutcomes = await mapWithConcurrency(
        claimedEmails,
        SEND_CONCURRENCY,
        async (outboxEmail) => {
          try {
            return (await this.deliverOutboxEmail(outboxEmail)).outcome;
          } catch (deliveryError) {
            // Leave the email in SENDING for the stale reclaim; one bad email
            // must not abort the rest of the batch.
            this.logger.error(
              {
                event: 'email_outbox.delivery_error',
                email_id: outboxEmail.id,
                category: outboxEmail.category,
                err: deliveryError,
              },
              'Failed to process an outbox email; it will be reclaimed',
            );
            return 'errored';
          }
        },
      );
      for (const deliveryOutcome of deliveryOutcomes) {
        drainSummary[deliveryOutcome] += 1;
      }
    }

    return drainSummary;
  }

  async purgeSettledEmails(): Promise<number> {
    const purgedEmails = await this.db
      .delete(schema.emailOutbox)
      .where(
        and(
          inArray(schema.emailOutbox.status, TERMINAL_STATUSES),
          lt(schema.emailOutbox.updatedAt, new Date(Date.now() - RETENTION_MS)),
        ),
      )
      .returning({ id: schema.emailOutbox.id });
    return purgedEmails.length;
  }

  private async findOutboxEmailById(
    id: string,
  ): Promise<EmailOutboxEntity | undefined> {
    const [outboxEmail] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.id, id))
      .limit(1);
    return outboxEmail;
  }

  private async claimOutboxEmailById(
    id: string,
  ): Promise<EmailOutboxEntity | undefined> {
    const [claimedEmail] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.SENDING,
        attempts: sql`${schema.emailOutbox.attempts} + 1`,
        // DB clock: the stale reclaim compares updated_at against now().
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.emailOutbox.id, id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.PENDING),
        ),
      )
      .returning();
    return claimedEmail;
  }

  private async claimOutboxEmailBatch(
    limit: number,
  ): Promise<EmailOutboxEntity[]> {
    // Raw SQL because the claim must be a single atomic statement; a
    // SELECT-then-UPDATE pair would race across replicas.
    const claimResult = (await this.db.execute(sql`
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

    const claimedIds = (claimResult.rows ?? []).map((row) => row.id);
    if (claimedIds.length === 0) return [];

    const claimedEmails = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(inArray(schema.emailOutbox.id, claimedIds));

    const emailsById = new Map(
      claimedEmails.map((outboxEmail) => [outboxEmail.id, outboxEmail]),
    );
    return claimedIds
      .map((id) => emailsById.get(id))
      .filter(
        (outboxEmail): outboxEmail is EmailOutboxEntity =>
          outboxEmail !== undefined,
      );
  }

  private async reclaimStaleSending(): Promise<void> {
    const reclaimResult = (await this.db.execute(sql`
      UPDATE email_outbox
      SET status = 'PENDING', next_attempt_at = now(), updated_at = now()
      WHERE status = 'SENDING'
        AND updated_at < now() - (${STALE_SENDING_MS} * interval '1 millisecond')
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };

    if (reclaimResult.rows?.length) {
      this.logger.warn(
        {
          event: 'email_outbox.reclaimed_stale',
          count: reclaimResult.rows.length,
        },
        'Reclaimed emails stuck in SENDING',
      );
    }
  }

  private async deliverOutboxEmail(outboxEmail: EmailOutboxEntity): Promise<{
    outcome: 'sent' | 'retried' | 'failed' | 'cancelled';
    result: EmailSendResult;
  }> {
    if (
      outboxEmail.expiresAt &&
      outboxEmail.expiresAt.getTime() <= Date.now()
    ) {
      await this.markOutboxEmailCancelled(outboxEmail);
      return {
        outcome: 'cancelled',
        result: {
          ok: false,
          retryable: false,
          error: new Error('Email expired before delivery'),
        },
      };
    }

    // An email that keeps throwing before the transport never reaches the
    // transport-failure branch, so cap it here on the next claim.
    if (outboxEmail.attempts > outboxEmail.maxAttempts) {
      const deliveryError = new Error('Maximum delivery attempts exceeded');
      await this.markOutboxEmailFailed(outboxEmail, deliveryError);
      return {
        outcome: 'failed',
        result: { ok: false, retryable: false, error: deliveryError },
      };
    }

    if (outboxEmail.html === null) {
      const deliveryError = new Error('Email content is missing');
      await this.markOutboxEmailFailed(outboxEmail, deliveryError);
      return {
        outcome: 'failed',
        result: { ok: false, retryable: false, error: deliveryError },
      };
    }

    const deliveryResult = await this.transport.sendOnce({
      to: outboxEmail.recipientEmail,
      subject: outboxEmail.subject,
      html: outboxEmail.html,
      text: outboxEmail.textBody ?? undefined,
      attachments: deserializeAttachments(outboxEmail.attachments),
      userId: outboxEmail.userId ?? undefined,
      emailId: outboxEmail.id,
    });

    if (deliveryResult.ok) {
      await this.markOutboxEmailSent(
        outboxEmail,
        deliveryResult.providerMessageId,
      );
      return { outcome: 'sent', result: deliveryResult };
    }

    if (
      !deliveryResult.retryable ||
      outboxEmail.attempts >= outboxEmail.maxAttempts
    ) {
      await this.markOutboxEmailFailed(outboxEmail, deliveryResult.error);
      return { outcome: 'failed', result: deliveryResult };
    }

    await this.scheduleOutboxEmailRetry(outboxEmail, deliveryResult.error);
    return { outcome: 'retried', result: deliveryResult };
  }

  private async markOutboxEmailSent(
    outboxEmail: EmailOutboxEntity,
    providerMessageId: string | null,
  ): Promise<void> {
    const [updatedEmail] = await this.db
      .update(schema.emailOutbox)
      .set({
        ...CLEARED_CONTENT,
        status: EmailDeliveryStatus.SENT,
        sentAt: new Date(),
        providerMessageId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, outboxEmail.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, outboxEmail.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updatedEmail) {
      this.logStaleTransition(outboxEmail, EmailDeliveryStatus.SENT);
      return;
    }
  }

  private async scheduleOutboxEmailRetry(
    outboxEmail: EmailOutboxEntity,
    deliveryError: Error,
  ): Promise<void> {
    const retryDelayMs = computeNextAttemptDelayMs(outboxEmail.attempts);

    const [updatedEmail] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.PENDING,
        nextAttemptAt: sql`now() + (${retryDelayMs} * interval '1 millisecond')`,
        lastError: summarizeError(deliveryError.message),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, outboxEmail.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, outboxEmail.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updatedEmail) {
      this.logStaleTransition(outboxEmail, EmailDeliveryStatus.PENDING);
      return;
    }

    this.logger.warn(
      {
        event: 'email_outbox.retry_scheduled',
        email_id: outboxEmail.id,
        category: outboxEmail.category,
        attempt: outboxEmail.attempts,
        max_attempts: outboxEmail.maxAttempts,
        delay_ms: retryDelayMs,
        err: deliveryError.message,
      },
      'Email delivery failed; retry scheduled',
    );
  }

  private async markOutboxEmailFailed(
    outboxEmail: EmailOutboxEntity,
    deliveryError: Error,
  ): Promise<void> {
    const [updatedEmail] = await this.db
      .update(schema.emailOutbox)
      .set({
        ...CLEARED_CONTENT,
        status: EmailDeliveryStatus.FAILED,
        lastError: summarizeError(deliveryError.message),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, outboxEmail.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, outboxEmail.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updatedEmail) {
      this.logStaleTransition(outboxEmail, EmailDeliveryStatus.FAILED);
      return;
    }

    this.logger.error(
      {
        event: 'email_outbox.failed',
        email_id: outboxEmail.id,
        category: outboxEmail.category,
        attempts: outboxEmail.attempts,
        err: deliveryError.message,
      },
      'Email delivery failed permanently',
    );
  }

  private async markOutboxEmailCancelled(
    outboxEmail: EmailOutboxEntity,
  ): Promise<void> {
    const [updatedEmail] = await this.db
      .update(schema.emailOutbox)
      .set({
        ...CLEARED_CONTENT,
        status: EmailDeliveryStatus.CANCELLED,
        lastError: 'Expired before delivery',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.emailOutbox.id, outboxEmail.id),
          eq(schema.emailOutbox.status, EmailDeliveryStatus.SENDING),
          eq(schema.emailOutbox.attempts, outboxEmail.attempts),
        ),
      )
      .returning({ id: schema.emailOutbox.id });

    if (!updatedEmail) {
      this.logStaleTransition(outboxEmail, EmailDeliveryStatus.CANCELLED);
      return;
    }

    this.logger.warn(
      {
        event: 'email_outbox.cancelled',
        email_id: outboxEmail.id,
        category: outboxEmail.category,
        expires_at: outboxEmail.expiresAt?.toISOString(),
      },
      'Email expired before it could be delivered',
    );
  }

  private logStaleTransition(
    outboxEmail: EmailOutboxEntity,
    targetStatus: EmailDeliveryStatus,
  ): void {
    this.logger.warn(
      {
        event: 'email_outbox.transition_skipped',
        email_id: outboxEmail.id,
        target: targetStatus,
      },
      'Outbox email is no longer SENDING; ignoring late transition',
    );
  }
}

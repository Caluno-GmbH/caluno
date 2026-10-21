import {
  index,
  integer,
  jsonb,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';
import {
  EmailCategory,
  EmailDeliveryStatus,
} from '../email/outbox/email-outbox.enums';

/** Attachments are rendered once at enqueue time and stored as base64 so a retry is byte-identical. */
export interface StoredEmailAttachment {
  filename: string;
  contentType: string;
  cid?: string;
  content: string;
}

export const emailDeliveryStatusEnum = pgEnum(
  'email_delivery_status',
  enumValues(EmailDeliveryStatus),
);

export const emailCategoryEnum = pgEnum(
  'email_category',
  enumValues(EmailCategory),
);

/**
 * Durable outbox for every email. A worker drains rows with bounded
 * concurrency; the rendered payload is stored so retries are byte-identical.
 */
export const emailOutbox = snakeCase.table(
  'email_outbox',
  {
    ...idColumn,
    /** Optional caller-provided idempotency key. Multiple NULLs are allowed. */
    dedupeKey: text('dedupe_key'),
    category: emailCategoryEnum('category').$type<EmailCategory>().notNull(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    textBody: text('text_body'),
    attachments: jsonb('attachments').$type<StoredEmailAttachment[] | null>(),
    organizationUnitId: uuid('organization_unit_id').references(
      () => organizationUnits.id,
      { onDelete: 'set null' },
    ),
    instanceId: uuid('instance_id'),
    status: emailDeliveryStatusEnum('status')
      .$type<EmailDeliveryStatus>()
      .notNull()
      .default(EmailDeliveryStatus.PENDING),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(8),
    nextAttemptAt: timestamp('next_attempt_at').notNull().defaultNow(),
    /** After this instant the message is no longer useful (e.g. the shift started). */
    expiresAt: timestamp('expires_at'),
    lastError: text('last_error'),
    /** Scaleway TEM message id, used to correlate webhook delivery events later. */
    providerMessageId: text('provider_message_id'),
    sentAt: timestamp('sent_at'),
    /** Filled from TEM webhooks once configured; SENT only proves provider acceptance. */
    deliveredAt: timestamp('delivered_at'),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_email_outbox_dedupe_key').on(table.dedupeKey),
    index('idx_email_outbox_status_next_attempt').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('idx_email_outbox_organization_unit_created_at').on(
      table.organizationUnitId,
      table.createdAt,
    ),
    index('idx_email_outbox_user_id').on(table.userId),
    index('idx_email_outbox_provider_message_id').on(table.providerMessageId),
  ],
);

export type EmailOutboxEntity = typeof emailOutbox.$inferSelect;

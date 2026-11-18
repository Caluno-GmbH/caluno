import {
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { EmailDeliveryStatus } from '../../notification/email/outbox/email-outbox.enums';
import {
  emailDeliveryStatusEnum,
  emailOutbox,
} from '../../notification/schemas/email-outbox.schema';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';
import {
  BundleDeliveryIssue,
  BundleDeliveryMethod,
  ReimbursementTypeKey,
} from '../enums';
import { bundleDeliveryMethodEnum } from './accounting-delivery-setting.schema';
import {
  reimbursementTypeKeyEnum,
  reimbursementTypes,
} from './reimbursement-type.schema';

export const bundleDeliveryIssueEnum = pgEnum(
  'bundle_delivery_issue',
  enumValues(BundleDeliveryIssue),
);

/**
 * Append-only log of every bundle handed to accounting, downloaded or sent.
 * Unlike `reimbursement_bundle_downloads` (latest download only), each
 * delivery keeps its own row. Recipient and subject are snapshots: the
 * settings can change later, the log must still say where it went.
 */
export const reimbursementBundleDeliveries = snakeCase.table(
  'reimbursement_bundle_deliveries',
  {
    ...idColumn,
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'restrict' })
      .notNull(),
    volunteerId: text('volunteer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reimbursementTypeId: reimbursementTypeKeyEnum('reimbursement_type_id')
      .$type<ReimbursementTypeKey>()
      .references(() => reimbursementTypes.key, { onDelete: 'restrict' })
      .notNull(),
    method: bundleDeliveryMethodEnum('method')
      .$type<BundleDeliveryMethod>()
      .notNull(),
    invoiceIds: uuid('invoice_ids').array().notNull(),
    recipientEmail: text('recipient_email'),
    subject: text('subject'),
    issues: bundleDeliveryIssueEnum('issues')
      .$type<BundleDeliveryIssue>()
      .array()
      .notNull()
      .default([]),
    // The outbox purges settled rows after 30 days; the delivery outlives
    // them, so the outcome is copied onto `emailStatus` when the email settles.
    emailOutboxId: uuid('email_outbox_id').references(() => emailOutbox.id, {
      onDelete: 'set null',
    }),
    emailStatus:
      emailDeliveryStatusEnum('email_status').$type<EmailDeliveryStatus>(),
    deliveredByUserId: text('delivered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_reimbursement_bundle_deliveries_unit_occurred_at').on(
      table.organizationUnitId,
      table.occurredAt,
    ),
    index('idx_reimbursement_bundle_deliveries_invoice_ids').using(
      'gin',
      table.invoiceIds,
    ),
  ],
);

export type ReimbursementBundleDeliveryEntity =
  typeof reimbursementBundleDeliveries.$inferSelect;
export type ReimbursementBundleDeliveryInsert =
  typeof reimbursementBundleDeliveries.$inferInsert;

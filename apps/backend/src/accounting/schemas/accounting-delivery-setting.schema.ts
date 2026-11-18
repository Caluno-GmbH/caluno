import {
  pgEnum,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { organizations } from '../../organization/schemas/organization.schema';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';
import { BundleDeliveryMethod } from '../enums';

export const bundleDeliveryMethodEnum = pgEnum(
  'bundle_delivery_method',
  enumValues(BundleDeliveryMethod),
);

/**
 * How a unit hands finished bundles to accounting. Every column is nullable
 * and null means "inherit": each field resolves on its own up the unit's
 * ancestor chain, so a unit can override only the recipient and keep its
 * parent's mode and subject.
 */
export const accountingDeliverySettings = snakeCase.table(
  'accounting_delivery_settings',
  {
    ...idColumn,
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    deliveryMethod:
      bundleDeliveryMethodEnum('delivery_method').$type<BundleDeliveryMethod>(),
    recipientEmail: text('recipient_email'),
    emailSubject: text('email_subject'),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex('uq_accounting_delivery_settings_unit').on(
      table.organizationUnitId,
    ),
  ],
);

export type AccountingDeliverySettingEntity =
  typeof accountingDeliverySettings.$inferSelect;
export type AccountingDeliverySettingInsert =
  typeof accountingDeliverySettings.$inferInsert;

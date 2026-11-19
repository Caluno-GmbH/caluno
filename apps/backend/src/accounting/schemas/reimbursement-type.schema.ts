import { integer, pgEnum, snakeCase, text } from 'drizzle-orm/pg-core';
import { timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { ReimbursementTypeKey } from '../enums';

export const reimbursementTypeKeyEnum = pgEnum(
  'reimbursement_type_key',
  enumValues(ReimbursementTypeKey),
);

export const reimbursementTypes = snakeCase.table('reimbursement_types', {
  key: reimbursementTypeKeyEnum('key')
    .$type<ReimbursementTypeKey>()
    .primaryKey(),
  legalReference: text('legal_reference').notNull(),
  yearlyLimitCents: integer('yearly_limit_cents').notNull(),
  platformDefaultRateCents: integer('platform_default_rate_cents').notNull(),
  ...timestampColumns,
});

export type ReimbursementTypeEntity = typeof reimbursementTypes.$inferSelect;
export type ReimbursementTypeInsert = typeof reimbursementTypes.$inferInsert;

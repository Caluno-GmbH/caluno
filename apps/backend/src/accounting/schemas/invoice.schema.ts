import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';
import { files } from '../../storage/schemas/file.schema';
import { InvoiceStatus } from '../enums';
import { documentTemplates } from './document-template.schema';
import { reimbursementTypes } from './reimbursement-type.schema';
import { signeeTypeEnum } from './template-signee.schema';

export const invoiceStatusEnum = pgEnum(
  'invoice_status',
  enumValues(InvoiceStatus),
);

export type InvoiceBody = {
  header: unknown;
  blocks: unknown[];
  footer: unknown;
};

export const invoices = snakeCase.table(
  'invoices',
  {
    ...idColumn,
    documentTemplateId: uuid('document_template_id')
      .references(() => documentTemplates.id, { onDelete: 'restrict' })
      .notNull(),
    volunteerId: text('volunteer_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    reimbursementTypeId: uuid('reimbursement_type_id')
      .references(() => reimbursementTypes.id, { onDelete: 'restrict' })
      .notNull(),
    organizationUnitId: uuid('organization_unit_id').references(
      () => organizationUnits.id,
      { onDelete: 'restrict' },
    ),
    fileId: uuid('file_id').references(() => files.id, {
      onDelete: 'set null',
    }),
    invoiceStatus: invoiceStatusEnum('invoice_status')
      .$type<InvoiceStatus>()
      .notNull(),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    totalAmountCents: integer('total_amount_cents').notNull(),
    totalHours: numeric('total_hours', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    isNonCompliant: boolean('is_non_compliant').notNull().default(false),
    resolvedBody: jsonb('resolved_body').$type<InvoiceBody>().notNull(),
    fieldOverrides: jsonb('field_overrides')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    declineReason: text('decline_reason'),
    declinedByUserId: text('declined_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    paidAt: timestamp('paid_at'),
    paidByUserId: text('paid_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    declinedAt: timestamp('declined_at'),
    declinedAtSigneeType: signeeTypeEnum('declined_at_signee_type'),

    // The document number the timesheet was issued under, frozen at creation.
    // Null on invoices created before numbering existed; those still fall back to
    // the number the renderer computes from the template's format.
    documentNumber: text('document_number'),
    // The counter behind that number. Kept as its own column so the next one is
    // `max + 1` rather than a parse of the formatted string.
    documentNumberSeq: integer('document_number_seq'),
    // The year that counter belongs to — the series restarts at 1 each January,
    // as an organisation's books do. Stored rather than derived from
    // `periodStart` in SQL, so the year is the one the app's calendar sees
    // rather than whatever time zone the database happens to run in.
    documentNumberYear: integer('document_number_year'),
    // Which body's series the number belongs to. Resolved at creation, because
    // `organizationUnitId` above is null for an org-wide template while the
    // number still has to be unique within the organisation that issues it.
    documentNumberScopeUnitId: uuid('document_number_scope_unit_id').references(
      () => organizationUnits.id,
      { onDelete: 'restrict' },
    ),
    ...timestampColumns,
  },
  (table) => [
    // Partial, because rows predating numbering carry nulls and Postgres would
    // otherwise treat each null pair as distinct anyway.
    uniqueIndex('uq_invoices_document_number')
      .on(table.documentNumberScopeUnitId, table.documentNumber)
      .where(
        sql`${table.documentNumberScopeUnitId} IS NOT NULL AND ${table.documentNumber} IS NOT NULL`,
      ),
  ],
);

export type InvoiceEntity = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;

import {
  boolean,
  index,
  integer,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { ExportTable } from '../enums';

export const exportTableEnum = pgEnum('export_table', enumValues(ExportTable));

export const exportLogs = snakeCase.table(
  'export_logs',
  {
    ...idColumn,
    organizationUnitId: uuid('organization_unit_id').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    tableKind: exportTableEnum('table_kind').$type<ExportTable>().notNull(),
    columns: text('columns').array().notNull(),
    includedTechnicalIds: boolean('included_technical_ids').notNull(),
    rowCount: integer('row_count').notNull(),
    subjectUserIds: text('subject_user_ids').array().notNull(),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_export_logs_organization_unit_id_occurred_at').on(
      table.organizationUnitId,
      table.occurredAt,
    ),
  ],
);

export type ExportLogEntity = typeof exportLogs.$inferSelect;
export type ExportLogInsert = typeof exportLogs.$inferInsert;

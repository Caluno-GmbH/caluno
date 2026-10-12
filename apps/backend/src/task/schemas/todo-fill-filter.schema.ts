import { integer, snakeCase, text, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';

/** One row per admin per organisation. Missing row means the defaults. */
export const todoFillFilters = snakeCase.table(
  'todo_fill_filters',
  {
    ...idColumn,
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    threshold: text('threshold').notNull().default('BELOW_MINIMUM'),
    daysAhead: integer('days_ahead').notNull().default(14),
    ...timestampColumns,
  },
  (table) => [unique().on(table.userId, table.organizationUnitId)],
);

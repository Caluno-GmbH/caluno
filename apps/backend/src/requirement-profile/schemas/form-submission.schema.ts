import {
  index,
  snakeCase,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';
import { requirementForms } from './requirement-form.schema';

export const formSubmissions = snakeCase.table(
  'form_submissions',
  {
    ...idColumn,
    formId: uuid('form_id')
      .references(() => requirementForms.id, { onDelete: 'restrict' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_form_submissions_user_form_unit').on(
      table.userId,
      table.formId,
      table.organizationUnitId,
    ),
    index('idx_form_submissions_form_id').on(table.formId),
    index('idx_form_submissions_user_id').on(table.userId),
    index('idx_form_submissions_organization_unit_id').on(
      table.organizationUnitId,
    ),
  ],
);

export type FormSubmissionEntity = typeof formSubmissions.$inferSelect;
export type FormSubmissionInsert = typeof formSubmissions.$inferInsert;

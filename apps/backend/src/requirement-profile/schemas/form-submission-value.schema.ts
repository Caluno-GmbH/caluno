import { index, jsonb, snakeCase, uuid } from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { formBlockFields } from './form-block-field.schema';
import { formSubmissions } from './form-submission.schema';

export const formSubmissionValues = snakeCase.table(
  'form_submission_values',
  {
    ...idColumn,
    submissionId: uuid('submission_id')
      .references(() => formSubmissions.id, { onDelete: 'cascade' })
      .notNull(),
    fieldId: uuid('field_id')
      .references(() => formBlockFields.id)
      .notNull(),
    value: jsonb('value').notNull(),
    ...timestampColumns,
  },
  (table) => [
    index('idx_form_submission_values_submission_id').on(table.submissionId),
    index('idx_form_submission_values_field_id').on(table.fieldId),
  ],
);

export type FormSubmissionValueEntity =
  typeof formSubmissionValues.$inferSelect;
export type FormSubmissionValueInsert =
  typeof formSubmissionValues.$inferInsert;

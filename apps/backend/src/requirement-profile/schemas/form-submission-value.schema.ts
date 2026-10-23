import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  snakeCase,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { formBlockFields } from './form-block-field.schema';
import { formSubmissions } from './form-submission.schema';
import { organizationUserProfiles } from './organization-user-profile.schema';

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
    organizationUserProfileId: uuid('organization_user_profile_id').references(
      () => organizationUserProfiles.id,
      { onDelete: 'set null' },
    ),
    ...timestampColumns,
  },
  (table) => [
    index('idx_form_submission_values_submission_id').on(table.submissionId),
    index('idx_form_submission_values_field_id').on(table.fieldId),
    index('idx_form_submission_values_organization_user_profile_id').on(
      table.organizationUserProfileId,
    ),
    uniqueIndex('uq_form_submission_values_profile_field')
      .on(table.organizationUserProfileId, table.fieldId)
      .where(sql`${table.organizationUserProfileId} IS NOT NULL`),
  ],
);

export type FormSubmissionValueEntity =
  typeof formSubmissionValues.$inferSelect;
export type FormSubmissionValueInsert =
  typeof formSubmissionValues.$inferInsert;

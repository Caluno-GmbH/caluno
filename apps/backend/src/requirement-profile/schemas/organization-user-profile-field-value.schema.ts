import { index, jsonb, snakeCase, unique, uuid } from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { formBlockFields } from './form-block-field.schema';
import { organizationUserProfiles } from './organization-user-profile.schema';

export const organizationUserProfileFieldValues = snakeCase.table(
  'organization_user_profile_field_values',
  {
    ...idColumn,
    organizationUserProfileId: uuid('organization_user_profile_id')
      .references(() => organizationUserProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    fieldId: uuid('field_id')
      .references(() => formBlockFields.id, { onDelete: 'cascade' })
      .notNull(),
    value: jsonb('value').notNull(),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_org_user_profile_field_values_profile_field').on(
      table.organizationUserProfileId,
      table.fieldId,
    ),
    index('idx_org_user_profile_field_values_profile_id').on(
      table.organizationUserProfileId,
    ),
    index('idx_org_user_profile_field_values_field_id').on(table.fieldId),
  ],
);

export type OrganizationUserProfileFieldValueEntity =
  typeof organizationUserProfileFieldValues.$inferSelect;
export type OrganizationUserProfileFieldValueInsert =
  typeof organizationUserProfileFieldValues.$inferInsert;

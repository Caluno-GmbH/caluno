import { index, snakeCase, text, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { organizations } from '../../organization/schemas/organization.schema';

export const organizationUserProfiles = snakeCase.table(
  'organization_user_profiles',
  {
    ...idColumn,
    organizationId: uuid('organization_id')
      .references(() => organizations.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    note: text('note'),
    ...timestampColumns,
  },
  (table) => [
    index('idx_organization_user_profiles_organization_id').on(
      table.organizationId,
    ),
    index('idx_organization_user_profiles_user_id').on(table.userId),
  ],
);

export type OrganizationUserProfileEntity =
  typeof organizationUserProfiles.$inferSelect;
export type OrganizationUserProfileInsert =
  typeof organizationUserProfiles.$inferInsert;

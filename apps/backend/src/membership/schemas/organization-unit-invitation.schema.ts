import { snakeCase, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { organizationUnits } from '../../organization/schemas/organization-unit.schema';

/**
 * Last time a check-in "invite to organization unit" email was sent to a
 * volunteer — backs the per-(volunteer, unit) resend cooldown.
 */
export const organizationUnitInvitations = snakeCase.table(
  'organization_unit_invitations',
  {
    ...idColumn,
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationUnitId: uuid('organization_unit_id')
      .references(() => organizationUnits.id, { onDelete: 'cascade' })
      .notNull(),
    lastSentAt: timestamp('last_sent_at').notNull().defaultNow(),
    ...timestampColumns,
  },
  (table) => [
    unique('uq_organization_unit_invitations_user_id_organization_unit_id').on(
      table.userId,
      table.organizationUnitId,
    ),
  ],
);

export type OrganizationUnitInvitationEntity =
  typeof organizationUnitInvitations.$inferSelect;

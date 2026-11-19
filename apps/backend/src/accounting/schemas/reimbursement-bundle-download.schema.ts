import { snakeCase, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { ReimbursementTypeKey } from '../enums';
import {
  reimbursementTypeKeyEnum,
  reimbursementTypes,
} from './reimbursement-type.schema';

export const reimbursementBundleDownloads = snakeCase.table(
  'reimbursement_bundle_downloads',
  {
    ...idColumn,
    volunteerId: text('volunteer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reimbursementTypeKey: reimbursementTypeKeyEnum('reimbursement_type_key')
      .$type<ReimbursementTypeKey>()
      .references(() => reimbursementTypes.key, { onDelete: 'restrict' })
      .notNull(),
    downloadedAt: timestamp('downloaded_at').notNull(),
    downloadedByUserId: text('downloaded_by_user_id').references(
      () => users.id,
      {
        onDelete: 'set null',
      },
    ),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex('uq_reimbursement_bundle_downloads_volunteer_type').on(
      table.volunteerId,
      table.reimbursementTypeKey,
    ),
  ],
);

export type ReimbursementBundleDownloadEntity =
  typeof reimbursementBundleDownloads.$inferSelect;
export type ReimbursementBundleDownloadInsert =
  typeof reimbursementBundleDownloads.$inferInsert;

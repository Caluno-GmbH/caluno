import { index, snakeCase, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { TermsChangeClass } from '../enums';
import { termsChangeClassEnum } from './terms-version.schema';

export const termsNotifications = snakeCase.table(
  'terms_notifications',
  {
    ...idColumn,
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version').notNull(),
    class: termsChangeClassEnum('class').$type<TermsChangeClass>().notNull(),
    channel: text('channel').notNull().default('email'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
    ...timestampColumns,
  },
  (table) => [index('idx_terms_notifications_user_id').on(table.userId)],
);

export type TermsNotificationEntity = typeof termsNotifications.$inferSelect;

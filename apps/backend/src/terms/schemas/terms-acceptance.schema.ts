import { index, snakeCase, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { TermsChangeClass } from '../enums';
import { termsChangeClassEnum } from './terms-version.schema';

export const termsAcceptances = snakeCase.table(
  'terms_acceptances',
  {
    ...idColumn,
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    version: text('version').notNull(),
    class: termsChangeClassEnum('class').$type<TermsChangeClass>().notNull(),
    language: text('language').notNull(),
    acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
    documentFilename: text('document_filename').notNull(),
    documentHash: text('document_hash').notNull(),
    ...timestampColumns,
  },
  (table) => [
    index('idx_terms_acceptances_user_id').on(table.userId),
    index('idx_terms_acceptances_user_id_accepted_at').on(
      table.userId,
      table.acceptedAt,
    ),
  ],
);

export type TermsAcceptanceEntity = typeof termsAcceptances.$inferSelect;

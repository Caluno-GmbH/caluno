import {
  pgEnum,
  snakeCase,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { idColumn, timestampColumns } from '../../database/database-columns';
import { enumValues } from '../../database/typeutil';
import { TermsChangeClass } from '../enums';

export const termsChangeClassEnum = pgEnum(
  'terms_change_class',
  enumValues(TermsChangeClass),
);

export const termsVersions = snakeCase.table(
  'terms_versions',
  {
    ...idColumn,
    version: text('version').notNull(),
    class: termsChangeClassEnum('class').$type<TermsChangeClass>().notNull(),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    notificationSentAt: timestamp('notification_sent_at'),
    ...timestampColumns,
  },
  (table) => [unique('terms_versions_version_key').on(table.version)],
);

export type TermsVersionEntity = typeof termsVersions.$inferSelect;

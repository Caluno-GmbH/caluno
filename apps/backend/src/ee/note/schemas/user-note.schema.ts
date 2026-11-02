import { snakeCase, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../../../auth/schemas/auth.schema';
import { idColumn, timestampColumns } from '../../../database/database-columns';

/** EE: one free-text note per user. */
export const userNotes = snakeCase.table(
  'user_notes',
  {
    ...idColumn,
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull().default(''),
    ...timestampColumns,
  },
  (table) => [uniqueIndex('user_notes_user_id_uidx').on(table.userId)],
);

export type UserNoteEntity = typeof userNotes.$inferSelect;
export type NewUserNoteEntity = typeof userNotes.$inferInsert;

import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  index,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Postgres `xid8` — the 64-bit, monotonic transaction id.
 *
 * node-postgres has no parser for it, so it arrives as a plain string; that is
 * also the shape the cursors built on this column compare in SQL.
 */
const xid8 = customType<{ data: string }>({
  dataType: () => 'xid8',
});

/**
 * Append-only log of writes to feed-driven domain tables. Rows are only ever
 * written by the `*_change_feed` triggers installed in the
 * `change_feed_triggers` migration; the app itself never inserts here.
 *
 * It deliberately has no `updatedAt` (a log row is immutable) and no cascade
 * from the rows it records (a deleted contract still happened).
 */
export const changeFeedEntries = snakeCase.table(
  'change_feed_entries',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // The id of the transaction that performed the write, so the feed can be
    // read as "everything after cursor X". Stamped by the database, not the
    // writing code, so it is always the commit-order stamp.
    xid: xid8('xid').notNull().default(sql`pg_current_xact_id()`),
    // A `ChangeArea` value, e.g. 'contracts' or 'membership-requests'.
    area: text('area').notNull(),
    organizationUnitId: uuid('organization_unit_id'),
    userId: text('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_change_feed_entries_xid').on(table.xid),
    index('idx_change_feed_entries_created_at').on(table.createdAt),
  ],
);

export type ChangeFeedEntryEntity = typeof changeFeedEntries.$inferSelect;
export type ChangeFeedEntryInsert = typeof changeFeedEntries.$inferInsert;

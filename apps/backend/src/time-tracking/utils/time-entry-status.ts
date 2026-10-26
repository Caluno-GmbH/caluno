import { type SQL, sql } from 'drizzle-orm';
import { TimeEntryClosureKind } from '../enums/time-entry-closure-kind.enum';
import { TimeEntryStatus } from '../enums/time-entry-status.enum';
import {
  type TimeEntryEntity,
  timeEntries,
} from '../schemas/time-entry.schema';

export function deriveTimeEntryStatus(
  entry: Pick<TimeEntryEntity, 'endedAt' | 'closureKind'>,
): TimeEntryStatus {
  if (!entry.endedAt) {
    return TimeEntryStatus.OPEN;
  }
  return entry.closureKind === TimeEntryClosureKind.AUTO
    ? TimeEntryStatus.AUTO_CLOSED
    : TimeEntryStatus.CLOSED;
}

export function timeEntryStatusCondition(status: TimeEntryStatus): SQL {
  switch (status) {
    case TimeEntryStatus.OPEN:
      return sql`${timeEntries.endedAt} IS NULL`;
    case TimeEntryStatus.AUTO_CLOSED:
      return sql`${timeEntries.endedAt} IS NOT NULL AND ${timeEntries.closureKind} = ${TimeEntryClosureKind.AUTO}`;
    case TimeEntryStatus.CLOSED:
      return sql`${timeEntries.endedAt} IS NOT NULL AND ${timeEntries.closureKind} IS DISTINCT FROM ${TimeEntryClosureKind.AUTO}`;
  }
}

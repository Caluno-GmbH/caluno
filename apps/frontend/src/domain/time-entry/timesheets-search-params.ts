import { TimeEntrySortField, TimeEntryStatus } from '@repo/data';
import { parseAsArrayOf, parseAsStringEnum } from 'nuqs/server';
import { createTableParsers } from '@/components/data-table/table-params';

export const timesheetsSearchParams = {
  ...createTableParsers(
    Object.values(TimeEntrySortField) as TimeEntrySortField[],
    TimeEntrySortField.CreatedAt,
    'desc',
  ),
  status: parseAsArrayOf(
    parseAsStringEnum(Object.values(TimeEntryStatus) as TimeEntryStatus[]),
  ).withDefault([]),
};

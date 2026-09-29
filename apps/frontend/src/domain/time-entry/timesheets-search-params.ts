import { TimeEntrySortField } from '@repo/data';
import { createTableParsers } from '@/components/data-table/table-params';

export const timesheetsSearchParams = createTableParsers(
  Object.values(TimeEntrySortField) as TimeEntrySortField[],
  TimeEntrySortField.CreatedAt,
  'desc',
);

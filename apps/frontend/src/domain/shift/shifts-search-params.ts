import { ShiftSortField } from '@repo/data';
import {
  createFilterParsers,
  createTableParsers,
} from '@/components/data-table/table-params';

export const shiftsSearchParams = {
  ...createTableParsers(
    Object.values(ShiftSortField) as ShiftSortField[],
    ShiftSortField.CreatedAt,
    'desc',
  ),
  ...createFilterParsers(),
};

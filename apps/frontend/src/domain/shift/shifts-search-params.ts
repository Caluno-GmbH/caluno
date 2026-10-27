import { ShiftSortField, ShiftVisibility } from '@repo/data';
import {
  parseAsIsoDate,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
} from 'nuqs/server';
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
  dateFrom: parseAsIsoDate,
  dateTo: parseAsIsoDate,
  location: parseAsString.withDefault(''),
  visibility: parseAsStringEnum(Object.values(ShiftVisibility)),
  fill: parseAsStringLiteral(['', 'below', 'ok', 'full'] as const).withDefault(''),
};

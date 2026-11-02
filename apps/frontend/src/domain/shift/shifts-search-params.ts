import { ShiftSortField, ShiftVisibility } from '@repo/data';
import { format, isValid, parse } from 'date-fns';
import {
  createParser,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
} from 'nuqs/server';
import {
  createFilterParsers,
  createTableParsers,
} from '@/components/data-table/table-params';

/**
 * A calendar day as `yyyy-MM-dd`, read and written in local time. nuqs'
 * `parseAsIsoDate` serialises via `toISOString()`, which shifts a local
 * midnight east of UTC (e.g. Berlin) back to the previous day.
 */
export const parseAsLocalDate = createParser({
  parse: (value) => {
    const date = parse(value.slice(0, 10), 'yyyy-MM-dd', new Date());
    return isValid(date) ? date : null;
  },
  serialize: (date) => format(date, 'yyyy-MM-dd'),
  eq: (a, b) => a.getTime() === b.getTime(),
});

export const shiftsSearchParams = {
  ...createTableParsers(
    Object.values(ShiftSortField) as ShiftSortField[],
    ShiftSortField.CreatedAt,
    'desc',
  ),
  ...createFilterParsers(),
  dateFrom: parseAsLocalDate,
  dateTo: parseAsLocalDate,
  location: parseAsString.withDefault(''),
  visibility: parseAsStringEnum(Object.values(ShiftVisibility)),
  fill: parseAsStringLiteral(['', 'below', 'full'] as const).withDefault(''),
};

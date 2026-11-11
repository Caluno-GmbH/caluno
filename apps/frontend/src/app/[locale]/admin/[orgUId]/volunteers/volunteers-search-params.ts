import type { ColumnVisibilityState } from '@tanstack/react-table';
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';
import {
  createFilterParsers,
  pageParser,
  pageSizeParser,
} from '@/components/data-table/table-params';

const VOLUNTEER_SORT_FIELDS = ['name', 'email'] as const;

export const volunteersSearchParams = {
  ...createFilterParsers(),
  sort: parseAsStringLiteral(VOLUNTEER_SORT_FIELDS),
  dir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('asc'),
  page: pageParser,
  pageSize: pageSizeParser,
  roles: parseAsArrayOf(parseAsString).withDefault([]),
  gender: parseAsString,
  city: parseAsString,
  verified: parseAsStringLiteral([
    'all',
    'verified',
    'unverified',
  ] as const).withDefault('all'),
  cols: parseAsArrayOf(parseAsString).withDefault([]),
};

export const OPTIONAL_COLUMN_IDS = [
  'dateOfBirth',
  'gender',
  'phone',
  'address',
] as const;

export function columnVisibilityFromParam(
  cols: string[],
): ColumnVisibilityState {
  const enabled = new Set(cols);
  const visibility: ColumnVisibilityState = {};
  for (const id of OPTIONAL_COLUMN_IDS) {
    visibility[id] = enabled.has(id);
  }
  return visibility;
}

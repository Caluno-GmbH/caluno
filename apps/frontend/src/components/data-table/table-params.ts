import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
} from 'nuqs/server';
import type { SortDir } from './table-sort';

export const PAGE_SIZES = [15, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** URL param for the current page (1-based). */
export const pageParser = parseAsInteger.withDefault(1);

/**
 * URL param for rows per page. Stored as a string literal to constrain inputs;
 * convert to number with `Number(pageSize)` at the use site.
 */
export const pageSizeParser = parseAsStringLiteral([
  '15',
  '25',
  '50',
  '100',
] as const).withDefault('25');

export function createTableParsers<T extends string>(
  sortFields: readonly T[],
  defaultSort: T,
  defaultDir: SortDir,
) {
  return {
    sort: parseAsStringEnum([...sortFields]).withDefault(defaultSort),
    dir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault(defaultDir),
    page: pageParser,
    pageSize: pageSizeParser,
  };
}

export function createFilterParsers() {
  return { q: parseAsString.withDefault('') };
}

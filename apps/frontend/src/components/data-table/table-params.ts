import { parseAsInteger, parseAsStringEnum, parseAsStringLiteral } from 'nuqs';
import type { SortDir } from './table-sort';

export function createTableParsers<T extends string>(
  sortFields: readonly T[],
  defaultSort: T,
  defaultDir: SortDir,
) {
  return {
    sort: parseAsStringEnum([...sortFields]).withDefault(defaultSort),
    dir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault(defaultDir),
    page: parseAsInteger.withDefault(1),
  };
}

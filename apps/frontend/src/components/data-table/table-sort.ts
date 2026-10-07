export type SortDir = 'asc' | 'desc';

export interface ColumnSort {
  id: string;
  desc: boolean;
}

export function toSorting(sort: string, dir: SortDir): ColumnSort[] {
  return [{ id: sort, desc: dir === 'desc' }];
}

export function activeDir(sorted: false | 'asc' | 'desc'): SortDir | null {
  return sorted === 'asc' || sorted === 'desc' ? sorted : null;
}

export function ariaSort(
  dir: SortDir | null,
): 'ascending' | 'descending' | undefined {
  return dir === 'asc'
    ? 'ascending'
    : dir === 'desc'
      ? 'descending'
      : undefined;
}

export function readSort<T extends string>(
  sorting: ColumnSort[],
  fallback: { sort: T; dir: SortDir },
): { sort: T; dir: SortDir } {
  const active = sorting[0];
  if (!active) {
    return fallback;
  }
  // Column ids are the table's sort-field values by construction; the generic
  // keeps that guarantee at the call site instead of casting there.
  return { sort: active.id as T, dir: active.desc ? 'desc' : 'asc' };
}

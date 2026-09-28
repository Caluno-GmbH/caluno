export type SortDir = 'asc' | 'desc';

export interface ColumnSort {
  id: string;
  desc: boolean;
}

export function toSorting(sort: string, dir: SortDir): ColumnSort[] {
  return [{ id: sort, desc: dir === 'desc' }];
}

export function readSort(
  sorting: ColumnSort[],
  fallback: { sort: string; dir: SortDir },
): { sort: string; dir: SortDir } {
  const active = sorting[0];
  if (!active) {
    return fallback;
  }
  return { sort: active.id, dir: active.desc ? 'desc' : 'asc' };
}

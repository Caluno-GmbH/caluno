import { describe, expect, it } from 'bun:test';
import { readSort, toSorting } from './table-sort';

describe('toSorting', () => {
  it('maps asc to desc: false', () => {
    expect(toSorting('STARTED_AT', 'asc')).toEqual([
      { id: 'STARTED_AT', desc: false },
    ]);
  });

  it('maps desc to desc: true', () => {
    expect(toSorting('CREATED_AT', 'desc')).toEqual([
      { id: 'CREATED_AT', desc: true },
    ]);
  });
});

describe('readSort', () => {
  it('returns the fallback when there is no active sort', () => {
    expect(readSort([], { sort: 'CREATED_AT', dir: 'desc' })).toEqual({
      sort: 'CREATED_AT',
      dir: 'desc',
    });
  });

  it('reads the active column and direction', () => {
    expect(
      readSort([{ id: 'VOLUNTEER', desc: true }], {
        sort: 'CREATED_AT',
        dir: 'desc',
      }),
    ).toEqual({ sort: 'VOLUNTEER', dir: 'desc' });
  });
});

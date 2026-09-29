import { describe, expect, it } from 'bun:test';
import { createSearchParamsCache } from 'nuqs/server';
import { createTableParsers } from './table-params';

const FIELDS = ['CREATED_AT', 'STARTED_AT', 'VOLUNTEER'] as const;
const cache = createSearchParamsCache(
  createTableParsers(FIELDS, 'CREATED_AT', 'desc'),
);

describe('createTableParsers', () => {
  it('applies the table defaults when no params are present', () => {
    expect(cache.parse({})).toEqual({
      sort: 'CREATED_AT',
      dir: 'desc',
      page: 1,
    });
  });

  it('reads provided sort, direction and page', () => {
    expect(cache.parse({ sort: 'VOLUNTEER', dir: 'asc', page: '3' })).toEqual({
      sort: 'VOLUNTEER',
      dir: 'asc',
      page: 3,
    });
  });

  it('falls back to the default for an unknown sort field', () => {
    expect(cache.parse({ sort: 'NOPE' }).sort).toBe('CREATED_AT');
  });

  it('falls back to the default for an unknown direction', () => {
    expect(cache.parse({ dir: 'sideways' }).dir).toBe('desc');
  });
});

import { describe, expect, it } from 'bun:test';
import { createSearchParamsCache } from 'nuqs/server';
import {
  columnVisibilityFromParam,
  OPTIONAL_COLUMN_IDS,
  volunteersSearchParams,
} from './volunteers-search-params';

const cache = createSearchParamsCache(volunteersSearchParams);

describe('volunteersSearchParams defaults', () => {
  it('applies default values when no params are present', () => {
    const result = cache.parse({});
    expect(result.roles).toEqual([]);
    expect(result.gender).toBeNull();
    expect(result.city).toBeNull();
    expect(result.verified).toBe('all');
    expect(result.cols).toEqual([]);
  });
});

describe('columnVisibilityFromParam', () => {
  it('hides all four optional column ids when cols is empty', () => {
    const visibility = columnVisibilityFromParam([]);
    for (const id of OPTIONAL_COLUMN_IDS) {
      expect(visibility[id]).toBe(false);
    }
  });

  it('shows only phone when cols contains phone', () => {
    const visibility = columnVisibilityFromParam(['phone']);
    expect(visibility.phone).toBe(true);
    expect(visibility.dateOfBirth).toBe(false);
    expect(visibility.gender).toBe(false);
    expect(visibility.address).toBe(false);
  });
});

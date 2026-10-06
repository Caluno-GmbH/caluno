import { describe, expect, it } from 'bun:test';
import { addDays, startOfDay } from './date-helpers';
import {
  hasNextDiscoverDay,
  resolveDiscoverDayIndex,
  shouldFetchNextDiscoverPage,
} from './discover-paging';

const state = (
  overrides: Partial<Parameters<typeof hasNextDiscoverDay>[0]>,
) => ({
  loadedDayCount: 10,
  activeIndex: 3,
  hasMorePages: true,
  isFetching: false,
  ...overrides,
});

describe('hasNextDiscoverDay', () => {
  it('allows advancing between loaded days', () => {
    expect(hasNextDiscoverDay(state({}))).toBe(true);
  });

  it('allows advancing on the last loaded day when more pages exist', () => {
    expect(hasNextDiscoverDay(state({ activeIndex: 9 }))).toBe(true);
  });

  it('blocks advancing on the last loaded day when the feed is exhausted', () => {
    expect(
      hasNextDiscoverDay(state({ activeIndex: 9, hasMorePages: false })),
    ).toBe(false);
  });

  it('blocks advancing for an empty feed', () => {
    expect(
      hasNextDiscoverDay(state({ loadedDayCount: 0, activeIndex: 0 })),
    ).toBe(false);
  });
});

describe('shouldFetchNextDiscoverPage', () => {
  it('does not fetch while browsing loaded days', () => {
    expect(shouldFetchNextDiscoverPage(state({}))).toBe(false);
  });

  it('fetches when reaching the last loaded day with pages remaining', () => {
    expect(shouldFetchNextDiscoverPage(state({ activeIndex: 9 }))).toBe(true);
  });

  it('does not fetch once the feed is exhausted', () => {
    expect(
      shouldFetchNextDiscoverPage(
        state({ activeIndex: 9, hasMorePages: false }),
      ),
    ).toBe(false);
  });

  it('does not fetch while a fetch is already in flight', () => {
    expect(
      shouldFetchNextDiscoverPage(state({ activeIndex: 9, isFetching: true })),
    ).toBe(false);
  });

  it('does not fetch for an empty feed', () => {
    expect(shouldFetchNextDiscoverPage(state({ loadedDayCount: 0 }))).toBe(
      false,
    );
  });
});

describe('resolveDiscoverDayIndex', () => {
  const base = startOfDay(new Date());
  const loaded = [0, 1, 4].map((offset) => addDays(base, offset));

  it('returns the index of a loaded day', () => {
    expect(resolveDiscoverDayIndex(loaded, addDays(base, 1))).toBe(1);
  });

  it('falls forward to the next loaded day for an unloaded day in range', () => {
    expect(resolveDiscoverDayIndex(loaded, addDays(base, 2))).toBe(2);
  });

  it('points past the loaded days for a day beyond them', () => {
    expect(resolveDiscoverDayIndex(loaded, addDays(base, 30))).toBe(3);
  });

  it('returns 0 when nothing is loaded', () => {
    expect(resolveDiscoverDayIndex([], base)).toBe(0);
  });
});

describe('shouldFetchNextDiscoverPage for a day past the loaded pages', () => {
  it('fetches when the selected day lies beyond the loaded days', () => {
    expect(shouldFetchNextDiscoverPage(state({ activeIndex: 10 }))).toBe(true);
  });
});

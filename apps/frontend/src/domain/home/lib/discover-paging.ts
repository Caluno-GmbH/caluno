import { isSameDay } from './date-helpers';

export type DiscoverPagingState = {
  /** Distinct days with shifts among the loaded pages. */
  loadedDayCount: number;
  activeIndex: number;
  hasMorePages: boolean;
  isFetching: boolean;
};

export function hasNextDiscoverDay(state: DiscoverPagingState): boolean {
  return (
    state.loadedDayCount > 0 &&
    (state.hasMorePages || state.activeIndex < state.loadedDayCount - 1)
  );
}

export function shouldFetchNextDiscoverPage(
  state: DiscoverPagingState,
): boolean {
  return (
    state.loadedDayCount > 0 &&
    state.hasMorePages &&
    !state.isFetching &&
    state.activeIndex >= state.loadedDayCount - 1
  );
}

/**
 * Where the selected day sits among the loaded day groups (sorted ascending).
 * An unloaded day resolves to the next loaded day after it, or to
 * `loadedDays.length` when it lies past every loaded day — the day strip spans
 * the whole discover window, so it can offer days whose page isn't loaded yet.
 */
export function resolveDiscoverDayIndex(
  loadedDays: Date[],
  selectedDay: Date,
): number {
  const index = loadedDays.findIndex(
    (day) => isSameDay(day, selectedDay) || day > selectedDay,
  );
  return index >= 0 ? index : loadedDays.length;
}

export type PendingDiscoverDayAction =
  | { type: 'scroll'; date: Date }
  | { type: 'fetch' }
  | { type: 'none' };

/**
 * What to do for a day picked on a strip whose days can lie past the loaded
 * pages: load more while it's beyond them, otherwise scroll to it (or the
 * nearest loaded day after it, or the last one once the feed is exhausted).
 */
export function resolvePendingDiscoverDay(
  loadedDays: Date[],
  pendingDay: Date,
  hasMorePages: boolean,
): PendingDiscoverDayAction {
  const index = resolveDiscoverDayIndex(loadedDays, pendingDay);
  if (index >= loadedDays.length && hasMorePages) return { type: 'fetch' };
  const date = loadedDays[Math.min(index, loadedDays.length - 1)];
  return date ? { type: 'scroll', date } : { type: 'none' };
}

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

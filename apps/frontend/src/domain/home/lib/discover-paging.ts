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

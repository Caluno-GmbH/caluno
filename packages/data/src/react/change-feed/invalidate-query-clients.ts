import type { QueryClient } from '@tanstack/react-query';
import { queryMatchesChangedAreas } from './change-feed-poller';
import type { ChangeArea } from './query-meta';

/**
 * Pages that mount their own `DataProvider` keep their queries in a separate
 * QueryClient, so one feed answer has to reach every client in the tab.
 */
export function invalidateChangedAreas(
  queryClients: Iterable<QueryClient>,
  areas: ReadonlySet<ChangeArea>,
): void {
  for (const queryClient of new Set(queryClients)) {
    void queryClient.invalidateQueries({
      predicate: (query) => queryMatchesChangedAreas(query.meta, areas),
    });
  }
}

export function invalidateAllQueries(
  queryClients: Iterable<QueryClient>,
): void {
  for (const queryClient of new Set(queryClients)) {
    void queryClient.invalidateQueries();
  }
}

import { describe, expect, it } from 'bun:test';
import type { Query, QueryClient } from '@tanstack/react-query';
import {
  invalidateAllQueries,
  invalidateChangedAreas,
} from './invalidate-query-clients';
import { ChangeArea } from './query-meta';

type InvalidateFilters = { predicate?: (query: Query) => boolean } | undefined;

function recordingClient(queries: Query['meta'][]) {
  const invalidated: Query['meta'][][] = [];
  const queryClient = {
    invalidateQueries: (filters: InvalidateFilters) => {
      invalidated.push(
        queries.filter(
          (meta) => filters?.predicate?.({ meta } as Query) ?? true,
        ),
      );
    },
  } as unknown as QueryClient;
  return { queryClient, invalidated };
}

describe('invalidateChangedAreas', () => {
  it('reaches every query client once, including nested page providers', () => {
    const contracts = { changeAreas: [ChangeArea.Contracts] };
    const invoices = { changeAreas: [ChangeArea.Invoices] };
    const layout = recordingClient([contracts, invoices]);
    const page = recordingClient([contracts, undefined]);

    invalidateChangedAreas(
      [layout.queryClient, page.queryClient, layout.queryClient],
      new Set([ChangeArea.Contracts]),
    );

    expect(layout.invalidated).toEqual([[contracts]]);
    expect(page.invalidated).toEqual([[contracts]]);
  });
});

describe('invalidateAllQueries', () => {
  it('invalidates everything in every query client once', () => {
    const layout = recordingClient([undefined]);
    const page = recordingClient([undefined]);

    invalidateAllQueries([
      layout.queryClient,
      page.queryClient,
      page.queryClient,
    ]);

    expect(layout.invalidated).toHaveLength(1);
    expect(page.invalidated).toHaveLength(1);
  });
});

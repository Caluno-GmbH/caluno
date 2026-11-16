import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateTimeEntryListQueries } from './use-time-entries-all';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateTimeEntryListQueries', () => {
  // Confirming an auto-closed entry changes what the timesheets list reads
  // (status, confirmed hours), so the list has to be refreshed afterwards.
  it('refreshes every timesheets list', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateTimeEntryListQueries(queryClient);

    expect(keys).toContainEqual(['time-entries-all']);
  });
});

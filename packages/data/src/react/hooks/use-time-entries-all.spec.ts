import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import {
  invalidateTimeEntryListQueries,
  invalidateTimeEntryQueries,
} from './use-time-entries-all';

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

describe('invalidateTimeEntryQueries', () => {
  // Editing, creating, deleting, confirming or checking out changes the
  // entry the timesheets list renders and the entries accounting derives its
  // review and invoicing views from.
  it('refreshes the timesheets list and the accounting views built from entries', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateTimeEntryQueries(queryClient);

    expect(keys).toContainEqual(['time-entries-all']);
    expect(keys).toContainEqual(['accounting', 'eligible-time-entries']);
    expect(keys).toContainEqual(['accounting', 'awaiting-review-time-entries']);
    expect(keys).toContainEqual([
      'accounting',
      'volunteers-needing-timesheets',
    ]);
  });
});

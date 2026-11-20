import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateJoinShiftInstanceQueries } from './use-join-shift-instance';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateJoinShiftInstanceQueries', () => {
  // Joining a shift must refresh every list that shows the shift, plus the
  // Discover day counts of available shifts (VOLI-1620).
  it('refreshes the Discover day counts as well as the shift lists', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateJoinShiftInstanceQueries(queryClient, 'master-1');

    expect(keys).toContainEqual(['shift', 'master-1']);
    expect(keys).toContainEqual(['activeShifts']);
    expect(keys).toContainEqual(['myShiftInstances']);
    expect(keys).toContainEqual(['myShiftInstancesInfinite']);
    expect(keys).toContainEqual(['availableShiftInstancesInfinite']);
    expect(keys).toContainEqual(['availableShiftInstanceDayCounts']);
  });
});

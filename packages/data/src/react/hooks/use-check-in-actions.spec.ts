import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateCheckInApproveQueries } from './use-check-in-actions';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateCheckInApproveQueries', () => {
  // Approving a membership request turns a volunteer into a member, so the
  // manual check-in page (VOLI-1620) has to refresh the readiness, the request
  // queue, the nav badge count and the volunteer list it reads from.
  it('refreshes readiness, the request queue, the nav count and the volunteer list', () => {
    const { keys, queryClient } = recordInvalidations();
    invalidateCheckInApproveQueries(queryClient, 'unit-1');
    expect(keys).toContainEqual(['check-in-readiness', 'unit-1']);
    expect(keys).toContainEqual(['membershipRequests', 'unit-1']);
    expect(keys).toContainEqual(['membershipRequestCount', 'unit-1']);
    expect(keys).toContainEqual(['organization-volunteers', 'unit-1']);
  });
});

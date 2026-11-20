import { describe, expect, it } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateInviteMembersToEventQueries } from './use-events';

function recordInvalidations() {
  const keys: unknown[][] = [];
  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      keys.push(queryKey);
    },
  } as unknown as QueryClient;
  return { keys, queryClient };
}

describe('invalidateInviteMembersToEventQueries', () => {
  // The event detail and the "my events" lists show the invites, so both have
  // to refetch after inviting.
  it('refreshes the invites, the event and every "my events" list', () => {
    const { keys, queryClient } = recordInvalidations();

    invalidateInviteMembersToEventQueries(queryClient, 'event-1');

    expect(keys).toContainEqual(['eventInvites', 'event-1']);
    expect(keys).toContainEqual(['event', 'event-1']);
    expect(keys).toContainEqual(['myEvents']);
  });
});

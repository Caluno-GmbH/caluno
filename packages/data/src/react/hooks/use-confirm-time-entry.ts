'use client';

import { TimeEntryRepository } from '@repo/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

export function useConfirmTimeEntry() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new TimeEntryRepository(sdk);

  return useMutation({
    mutationFn: (id: string) => repository.confirm(id),
    onSuccess: () => {
      // Confirming moves an entry from "awaiting review" to "eligible" for
      // timesheets, so every accounting view derived from it is stale.
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'eligible-time-entries'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'awaiting-review-time-entries'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'volunteers-needing-timesheets'],
      });
    },
  });
}

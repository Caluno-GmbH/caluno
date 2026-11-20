'use client';

import { ShiftRepository } from '@repo/data';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

/**
 * Joining a shift changes both the shift's own lists and the Discover day
 * counts (VOLI-1620), so refresh every view that renders the shift.
 */
export function invalidateJoinShiftInstanceQueries(
  queryClient: QueryClient,
  shiftMasterId: string,
) {
  queryClient.invalidateQueries({
    queryKey: ['shift', shiftMasterId],
  });
  queryClient.invalidateQueries({
    queryKey: ['activeShifts'],
  });
  queryClient.invalidateQueries({
    queryKey: ['myShiftInstances'],
  });
  queryClient.invalidateQueries({
    queryKey: ['myShiftInstancesInfinite'],
  });
  queryClient.invalidateQueries({
    queryKey: ['availableShiftInstancesInfinite'],
  });
  queryClient.invalidateQueries({
    queryKey: ['availableShiftInstanceDayCounts'],
  });
}

export function useJoinShiftInstance() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new ShiftRepository(sdk);

  return useMutation({
    mutationFn: (instanceId: string) => repository.joinInstance(instanceId),
    onSuccess: (result) =>
      invalidateJoinShiftInstanceQueries(
        queryClient,
        result.shiftInstance.master.id,
      ),
  });
}

'use client';

import { ShiftRepository } from '@repo/data';
import { useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export function useCheckIn() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new ShiftRepository(sdk);

  return useMutation({
    mutationFn: (shiftInstanceId: string) =>
      repository.checkIn(shiftInstanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myShiftInstances'] });
    },
  });
}

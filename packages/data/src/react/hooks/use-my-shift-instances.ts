'use client';

import { ShiftRepository } from '@repo/data';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

export function useMyShiftInstances(
  options: Parameters<ShiftRepository['findMyShiftInstances']>[0] = {},
  queryOptions?: Omit<
    UseQueryOptions<
      Awaited<ReturnType<ShiftRepository['findMyShiftInstances']>>
    >,
    'queryKey' | 'queryFn'
  >,
) {
  const sdk = useSdk();
  const repository = new ShiftRepository(sdk);

  return useQuery({
    queryKey: ['myShiftInstances', options],
    queryFn: () => repository.findMyShiftInstances(options),
    staleTime: 0,
    ...queryOptions,
  });
}

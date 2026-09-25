'use client';

import { ShiftRepository } from '@repo/data';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

export function useAvailableShiftInstanceDayCounts(
  options: {
    startsAfter?: Date;
    endsBefore?: Date;
    organizationUnitIds?: string[];
    excludeIntended?: boolean;
  } = {},
  queryOptions?: Omit<
    UseQueryOptions<
      Awaited<
        ReturnType<ShiftRepository['findAvailableShiftInstanceDayCounts']>
      >
    >,
    'queryKey' | 'queryFn'
  >,
) {
  const sdk = useSdk();
  const repository = new ShiftRepository(sdk);

  return useQuery({
    queryKey: ['availableShiftInstanceDayCounts', options],
    queryFn: () => repository.findAvailableShiftInstanceDayCounts(options),
    staleTime: 0,
    ...queryOptions,
  });
}

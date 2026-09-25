'use client';

import { ShiftRepository } from '@repo/data';
import {
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

export type MyShiftInstancesInfiniteResult = Awaited<
  ReturnType<ShiftRepository['findMyShiftInstances']>
>;

type MyShiftInstancesOptions = Omit<
  NonNullable<Parameters<ShiftRepository['findMyShiftInstances']>[0]>,
  'offset'
>;

export function useMyShiftInstancesInfinite(
  options: MyShiftInstancesOptions = {},
  queryOptions?: Omit<
    UseInfiniteQueryOptions<
      MyShiftInstancesInfiniteResult,
      Error,
      InfiniteData<MyShiftInstancesInfiniteResult>,
      QueryKey,
      number
    >,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
  >,
) {
  const sdk = useSdk();
  const repository = new ShiftRepository(sdk);
  const limit = options.limit ?? 15;

  return useInfiniteQuery<
    MyShiftInstancesInfiniteResult,
    Error,
    InfiniteData<MyShiftInstancesInfiniteResult>,
    QueryKey,
    number
  >({
    queryKey: ['myShiftInstancesInfinite', options],
    queryFn: ({ pageParam }) =>
      repository.findMyShiftInstances({
        ...options,
        limit,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    staleTime: 0,
    ...queryOptions,
  });
}

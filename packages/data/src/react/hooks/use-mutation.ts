'use client';
import {
  type DefaultError,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation as useTanstackMutation,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { swallowNextRedirect } from '../../errors/next-redirect';

/**
 * `useMutation` for every hook in this package. A login redirect thrown from
 * `onError` still lands on the mutation (render rethrows it via
 * `throwOnError`), but `mutateAsync` never settles with it — so callers'
 * `catch` blocks do not toast "NEXT_REDIRECT" while the page navigates.
 */
export function useMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  queryClient?: QueryClient,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const mutation = useTanstackMutation(options, queryClient);
  const { mutateAsync } = mutation;
  const redirectSafeMutateAsync = useCallback<typeof mutateAsync>(
    (...args) => mutateAsync(...args).catch(swallowNextRedirect),
    [mutateAsync],
  );
  return { ...mutation, mutateAsync: redirectSafeMutateAsync };
}

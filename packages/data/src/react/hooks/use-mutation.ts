'use client';
import {
  type DefaultError,
  type MutateOptions,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation as useTanstackMutation,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  isNextRedirectError,
  swallowNextRedirect,
} from '../../errors/next-redirect';

/**
 * Per-call `onError` / `onSettled` (passed to `mutate` / `mutateAsync`) are
 * skipped for a redirect, like a never-settling `mutateAsync`: a caller's
 * failure toast must not fire while the page leaves for login.
 */
export function skipRedirectCallbacks<TData, TError, TVariables, TContext>(
  options: MutateOptions<TData, TError, TVariables, TContext> | undefined,
): MutateOptions<TData, TError, TVariables, TContext> | undefined {
  if (!options) return options;
  const { onError, onSettled } = options;
  return {
    ...options,
    onError: onError
      ? (error, ...rest) => {
          if (!isNextRedirectError(error)) return onError(error, ...rest);
        }
      : undefined,
    onSettled: onSettled
      ? (data, error, ...rest) => {
          if (!isNextRedirectError(error))
            return onSettled(data, error, ...rest);
        }
      : undefined,
  };
}

/**
 * `useMutation` for every hook in this package. A login redirect thrown from
 * `onError` still lands on the mutation (render rethrows it via
 * `throwOnError`), but the caller never hears about it: `mutateAsync` never
 * settles, and per-call `onError` / `onSettled` are skipped — so no toast
 * reads "NEXT_REDIRECT" or "failed" while the page navigates.
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
  const { mutate, mutateAsync } = mutation;
  // MutateFunctionRest is a tuple union TS cannot rebuild from its parts;
  // each cast only swaps the options slot for its redirect-safe copy.
  const redirectSafeMutate = useCallback<typeof mutate>(
    (...args) => {
      const [variables, mutateOptions] = args;
      mutate(
        ...([variables, skipRedirectCallbacks(mutateOptions)] as typeof args),
      );
    },
    [mutate],
  );
  const redirectSafeMutateAsync = useCallback<typeof mutateAsync>(
    (...args) => {
      const [variables, mutateOptions] = args;
      return mutateAsync(
        ...([variables, skipRedirectCallbacks(mutateOptions)] as typeof args),
      ).catch(swallowNextRedirect);
    },
    [mutateAsync],
  );
  return {
    ...mutation,
    mutate: redirectSafeMutate,
    mutateAsync: redirectSafeMutateAsync,
  };
}

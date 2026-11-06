'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createGraphQLClient } from '../../client/graphql-client';
import type { Locale } from '../../constants';
import type { DataError } from '../../errors/data-error';
import {
  shouldRetryQuery,
  shouldThrowRedirectError,
} from '../../errors/next-redirect';
import {
  GraphQLClientProvider,
  SdkOnErrorProvider,
} from '../hooks/use-graphql-client';

export interface DataProviderProps {
  children: ReactNode;
  apiUrl: string;
  queryClient?: QueryClient;
  showDevTools?: boolean;
  organizationUnitId?: string;
  locale?: Locale;
  /**
   * Called with the translated DataError before it is rethrown. Throw
   * Next's `redirect()` here for UNAUTHENTICATED / FORBIDDEN. Queries and
   * mutations rethrow that `NEXT_REDIRECT` during render, so it becomes a
   * navigation instead of a stored error.
   */
  onError?: (error: DataError) => void;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // One retry, matching the previous `retry: 1`. A redirect thrown from
        // `onError` is terminal — retrying it would issue another unauthorized
        // request and can drop the NEXT_REDIRECT before render rethrows it.
        retry: shouldRetryQuery,
        throwOnError: shouldThrowRedirectError,
      },
      mutations: {
        retry: shouldRetryQuery,
        throwOnError: shouldThrowRedirectError,
      },
    },
  });
}

export function DataProvider({
  children,
  apiUrl,
  queryClient: customQueryClient,
  showDevTools = process.env.NODE_ENV === 'development',
  organizationUnitId,
  locale,
  onError,
}: DataProviderProps) {
  const [ownQueryClient] = useState(createQueryClient);
  const queryClient = customQueryClient ?? ownQueryClient;

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        queryClient.clear();
      }
    }

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [queryClient]);

  const graphqlClient = useMemo(() => {
    const getHeaders = organizationUnitId
      ? (): Record<string, string> => {
          return { 'x-organization-unit-id': organizationUnitId };
        }
      : undefined;

    return createGraphQLClient({
      url: apiUrl,
      credentials: 'include',
      locale,
      headers: getHeaders,
    });
  }, [apiUrl, organizationUnitId, locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <GraphQLClientProvider value={graphqlClient}>
        <SdkOnErrorProvider onError={onError}>
          {children}
          {showDevTools && <ReactQueryDevtools />}
        </SdkOnErrorProvider>
      </GraphQLClientProvider>
    </QueryClientProvider>
  );
}

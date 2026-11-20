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
  BackgroundRefreshHoldProvider,
  useBackgroundRefreshHoldState,
} from '../change-feed/background-refresh-hold';
import { useChangeFeed } from '../change-feed/use-change-feed';
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
  /**
   * Mount the change-feed poller: a background `ChangesSince` poll that
   * invalidates queries by `meta.changeAreas`. Defaults to `false`, so public
   * pages and accept-terms never poll. Signed-in layouts opt in.
   */
  changeFeed?: boolean;
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
  changeFeed = false,
}: DataProviderProps) {
  const [ownQueryClient] = useState(createQueryClient);
  const queryClient = customQueryClient ?? ownQueryClient;

  const outerFeed = useBackgroundRefreshHoldState();
  const holdState = useChangeFeed({
    enabled: changeFeed,
    apiUrl,
    organizationUnitId,
    locale,
    queryClient,
  });

  // A nested page-level provider has its own QueryClient. It runs no poller of
  // its own, so it registers with the layout's feed to receive its
  // invalidations.
  const registerWithOuterFeed = holdState
    ? null
    : outerFeed?.registerQueryClient;
  useEffect(() => {
    if (!registerWithOuterFeed) {
      return;
    }
    return registerWithOuterFeed(queryClient);
  }, [registerWithOuterFeed, queryClient]);

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

  // A nested DataProvider without its own feed passes the outer feed through,
  // so holds taken inside it still reach the layout's poller. Always rendering
  // the provider keeps the subtree from remounting if `changeFeed` changes.
  return (
    <QueryClientProvider client={queryClient}>
      <GraphQLClientProvider value={graphqlClient}>
        <SdkOnErrorProvider onError={onError}>
          <BackgroundRefreshHoldProvider value={holdState ?? outerFeed}>
            {children}
            {showDevTools && <ReactQueryDevtools />}
          </BackgroundRefreshHoldProvider>
        </SdkOnErrorProvider>
      </GraphQLClientProvider>
    </QueryClientProvider>
  );
}

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createGraphQLClient } from '../../client/graphql-client';
import type { Locale } from '../../constants';
import { GraphQLClientProvider } from '../hooks/use-graphql-client';

export interface DataProviderProps {
  children: ReactNode;
  apiUrl: string;
  queryClient?: QueryClient;
  showDevTools?: boolean;
  organizationUnitId?: string;
  locale?: Locale;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 1,
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
        {children}
        {showDevTools && <ReactQueryDevtools />}
      </GraphQLClientProvider>
    </QueryClientProvider>
  );
}

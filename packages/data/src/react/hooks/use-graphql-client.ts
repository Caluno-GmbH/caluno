'use client';
import type { GraphQLClient } from 'graphql-request';
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react';
import type { DataError } from '../../errors/data-error';
import { createSdkErrorWrapper } from '../../errors/translate';
import { getSdk } from '../../generated/graphql';

const GraphQLClientContext = createContext<GraphQLClient | null>(null);
const SdkOnErrorContext = createContext<
  ((error: DataError) => void) | undefined
>(undefined);

export const GraphQLClientProvider = GraphQLClientContext.Provider;

export function SdkOnErrorProvider({
  onError,
  children,
}: {
  onError?: (error: DataError) => void;
  children: ReactNode;
}) {
  return createElement(
    SdkOnErrorContext.Provider,
    { value: onError },
    children,
  );
}

export function useGraphQLClient() {
  const client = useContext(GraphQLClientContext);
  if (!client) {
    throw new Error(
      'useGraphQLClient must be used within GraphQLClientProvider',
    );
  }
  return client;
}

export function useSdk() {
  const client = useGraphQLClient();
  const onError = useContext(SdkOnErrorContext);
  // Translate failures to DataError so hooks/consumers get the backend message
  // and code, not graphql-request's raw serialized-response ClientError.
  // `onError` may throw Next's redirect; createSdkErrorWrapper lets that
  // propagate instead of replacing it with the DataError.
  return getSdk(client, createSdkErrorWrapper(onError));
}

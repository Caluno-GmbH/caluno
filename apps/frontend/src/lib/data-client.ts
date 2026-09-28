import {
  createDataClient,
  type DataClient,
  LOCALE_HEADER,
  type Locale,
} from '@repo/data';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { GRAPHQL_API_URL } from './constants';
import { handleServerDataClientError } from './data-client-errors';

const globalForData = globalThis as unknown as {
  dataClient: DataClient | undefined;
};

export const data =
  globalForData.dataClient ??
  createDataClient({
    url: `${GRAPHQL_API_URL}`,
    credentials: 'include',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForData.dataClient = data;
}

interface GetDataClientOptions {
  orgUId?: string;
  locale?: Locale;
  /**
   * When false, UNAUTHENTICATED GraphQL errors are thrown for the caller to
   * handle (e.g. optional admin nav). Default: redirect to login.
   */
  redirectOnUnauthenticated?: boolean;
}

export async function getDataClient(
  options?: GetDataClientOptions,
): Promise<DataClient> {
  const { orgUId, locale, redirectOnUnauthenticated = true } = options ?? {};
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');

  const clientHeaders: Record<string, string> = {};

  if (orgUId) {
    clientHeaders['x-organization-unit-id'] = orgUId;
  }

  if (locale) {
    clientHeaders[LOCALE_HEADER] = locale;
  }

  if (cookieHeader) {
    clientHeaders.cookie = cookieHeader;
  }

  return createDataClient({
    url: GRAPHQL_API_URL,
    headers: clientHeaders,
    onError: (error) => {
      // Fallback only — callers should guard auth before hitting protected GQL.
      handleServerDataClientError(
        error,
        { redirectOnUnauthenticated },
        redirect,
      );
    },
  });
}

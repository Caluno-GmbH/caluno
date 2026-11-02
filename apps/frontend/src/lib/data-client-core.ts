import {
  type DataClient,
  type DataClientConfig,
  LOCALE_HEADER,
  type Locale,
} from '@repo/data';
import { resolveLocale } from '@/i18n/routing';
import { GRAPHQL_API_URL } from './constants';
import { handleServerDataClientError } from './data-client-errors';

export interface GetDataClientOptions {
  orgUId?: string;
  locale?: Locale;
  /**
   * When false, unauthenticated GraphQL errors (code UNAUTHENTICATED /
   * UNAUTHORIZED or HTTP 401) are thrown for the caller to
   * handle (e.g. optional admin nav). Default: redirect to login.
   */
  redirectOnUnauthenticated?: boolean;
}

interface GetDataClientDependencies {
  createDataClient: (config: DataClientConfig) => DataClient;
  getLocale: () => Promise<string>;
  getHeaders: () => Promise<{ get(name: string): string | null }>;
  redirect: (options: { href: string; locale: Locale }) => never;
}

/**
 * Creates a data-client getter with explicit dependencies. Tests inject simple
 * fakes for Next.js APIs instead of using mock.module(), whose overrides can
 * leak between test files because mock.restore() does not reset module mocks.
 */
export function createGetDataClient({
  createDataClient,
  getLocale,
  getHeaders,
  redirect,
}: GetDataClientDependencies) {
  return async function getDataClient(
    options?: GetDataClientOptions,
  ): Promise<DataClient> {
    const { orgUId, locale, redirectOnUnauthenticated = true } = options ?? {};
    const redirectLocale = locale ?? resolveLocale(await getLocale());
    const headersList = await getHeaders();
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
          (path) => redirect({ href: path, locale: redirectLocale }),
        );
      },
    });
  };
}

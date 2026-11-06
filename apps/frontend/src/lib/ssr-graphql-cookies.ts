/**
 * Server-side GraphQL fetches from React Query run in Node, where
 * `credentials: 'include'` does not attach the incoming request's Cookie
 * header. Copy that header onto calls to our GraphQL endpoint so a logged-in
 * render is not a false UNAUTHENTICATED.
 *
 * An existing Cookie header is left alone — `getDataClient` already sets one.
 */

const INSTALLED = Symbol.for('caluno.ssrGraphqlCookieForwarding');

type FetchInput = Parameters<typeof fetch>[0];

export function graphqlRequestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * Compares parsed origin + path, not raw strings: graphql-request hands fetch
 * a normalised `URL`, so `:443`, host case or a trailing slash in the
 * configured URL must not silently skip the cookie.
 */
export function isGraphqlRequestUrl(url: string, graphqlUrl: string): boolean {
  const request = parseUrl(url);
  const endpoint = parseUrl(graphqlUrl);
  if (!request || !endpoint) return false;
  const path = (u: URL) => u.pathname.replace(/\/+$/, '');
  return request.origin === endpoint.origin && path(request) === path(endpoint);
}

export function applyCookieHeader(
  init: RequestInit | undefined,
  cookieHeader: string | undefined,
): RequestInit | undefined {
  const cookie = cookieHeader?.trim();
  if (!cookie) return init;

  const headers = new Headers(init?.headers);
  if (headers.has('cookie')) return init;

  headers.set('cookie', cookie);
  return { ...init, headers };
}

export function createGraphqlCookieFetch(
  baseFetch: typeof fetch,
  options: {
    graphqlUrl: string;
    readCookieHeader: () => string | undefined | Promise<string | undefined>;
  },
): typeof fetch {
  return async (input, init) => {
    if (isGraphqlRequestUrl(graphqlRequestUrl(input), options.graphqlUrl)) {
      let cookie: string | undefined;
      try {
        cookie = await options.readCookieHeader();
      } catch {
        cookie = undefined;
      }
      init = applyCookieHeader(init, cookie);
    }
    return baseFetch(input, init);
  };
}

export function installSsrGraphqlCookieForwarding(options: {
  graphqlUrl: string;
  readCookieHeader: () => string | undefined | Promise<string | undefined>;
}): void {
  const globalRecord = globalThis as typeof globalThis & {
    [INSTALLED]?: boolean;
  };
  if (globalRecord[INSTALLED]) return;
  globalRecord[INSTALLED] = true;
  globalThis.fetch = createGraphqlCookieFetch(
    globalThis.fetch.bind(globalThis),
    options,
  );
}

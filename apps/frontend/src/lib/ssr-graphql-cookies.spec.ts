import { describe, expect, it, mock } from 'bun:test';
import {
  applyCookieHeader,
  createGraphqlCookieFetch,
  isGraphqlRequestUrl,
} from './ssr-graphql-cookies';

const GRAPHQL_URL = 'https://api.example.test/graphql';

describe('isGraphqlRequestUrl', () => {
  it('matches the endpoint and its query string', () => {
    expect(isGraphqlRequestUrl(GRAPHQL_URL, GRAPHQL_URL)).toBe(true);
    expect(isGraphqlRequestUrl(`${GRAPHQL_URL}?op=Get`, GRAPHQL_URL)).toBe(
      true,
    );
  });

  it('ignores other hosts', () => {
    expect(
      isGraphqlRequestUrl('https://api.example.test/api/auth', GRAPHQL_URL),
    ).toBe(false);
  });
});

describe('applyCookieHeader', () => {
  it('sets the cookie when the request has none', () => {
    const next = applyCookieHeader(undefined, 'session=abc');
    expect(new Headers(next?.headers).get('cookie')).toBe('session=abc');
  });

  it('leaves an existing cookie header in place', () => {
    const init = { headers: { cookie: 'session=already' } };
    expect(applyCookieHeader(init, 'session=other')).toBe(init);
  });

  it('ignores a blank cookie', () => {
    expect(applyCookieHeader(undefined, '  ')).toBeUndefined();
  });
});

describe('createGraphqlCookieFetch', () => {
  it('forwards the request cookie only to the GraphQL endpoint', async () => {
    const baseFetch = mock(async () => new Response('ok'));
    const fetchWithCookie = createGraphqlCookieFetch(baseFetch, {
      graphqlUrl: GRAPHQL_URL,
      readCookieHeader: () => 'better-auth.session_token=1',
    });

    await fetchWithCookie(GRAPHQL_URL, { method: 'POST' });
    await fetchWithCookie('https://api.example.test/other', { method: 'POST' });

    const graphqlInit = baseFetch.mock.calls[0]?.[1] as RequestInit;
    const otherInit = baseFetch.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(graphqlInit.headers).get('cookie')).toBe(
      'better-auth.session_token=1',
    );
    expect(otherInit.headers).toBeUndefined();
  });

  it('still fetches when the cookie reader throws', async () => {
    const baseFetch = mock(async () => new Response('ok'));
    const fetchWithCookie = createGraphqlCookieFetch(baseFetch, {
      graphqlUrl: GRAPHQL_URL,
      readCookieHeader: () => {
        throw new Error('headers() outside a request');
      },
    });

    await fetchWithCookie(GRAPHQL_URL, { method: 'POST' });
    expect(baseFetch).toHaveBeenCalledTimes(1);
    const init = baseFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });
});

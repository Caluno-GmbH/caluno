import { check } from 'k6';
import http, { type RefinedResponse } from 'k6/http';
import { Counter, Rate } from 'k6/metrics';
import { API_URL, LOCALE, SESSION_COOKIE_NAME, WEB_URL } from './config.ts';
import { operation } from './data.ts';

export const graphqlErrors = new Rate('graphql_errors');
export const rateLimited = new Counter('rate_limited');

/** `read`/`write` GraphQL, `auth` Better Auth + REST, `page` SSR HTML. */
export type RequestKind = 'read' | 'write' | 'auth' | 'page';

export interface Session {
  /** Signed session cookie value; omit for anonymous visitors. */
  cookie?: string;
  /** Sent as `x-organization-unit-id` for backoffice requests. */
  unitId?: string;
}

export interface GraphqlCall {
  name: string;
  variables?: Record<string, unknown>;
}

type GraphqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

const headersFor = (session: Session): Record<string, string> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-locale': LOCALE,
  };
  if (session.cookie) {
    headers.cookie = `${SESSION_COOKIE_NAME}=${session.cookie}`;
  }
  if (session.unitId) {
    headers['x-organization-unit-id'] = session.unitId;
  }
  return headers;
};

const kindOf = (name: string): RequestKind =>
  operation(name).trimStart().startsWith('mutation') ? 'write' : 'read';

const graphqlRequest = (session: Session, call: GraphqlCall) => ({
  method: 'POST',
  url: `${API_URL}/graphql`,
  body: JSON.stringify({
    operationName: call.name,
    query: operation(call.name),
    variables: call.variables ?? {},
  }),
  params: {
    headers: headersFor(session),
    tags: { name: call.name, kind: kindOf(call.name) },
  },
});

const record = (
  name: string,
  response: RefinedResponse<'text'>,
): Record<string, unknown> | null => {
  if (response.status === 429) {
    rateLimited.add(1, { name });
  }
  let body: GraphqlBody | null = null;
  try {
    body = response.json() as GraphqlBody;
  } catch {
    body = null;
  }
  const errors = body?.errors ?? [];
  graphqlErrors.add(errors.length > 0, { name });
  check(
    response,
    {
      [`${name} → 200`]: (r) => r.status === 200,
      [`${name} → no GraphQL errors`]: () => errors.length === 0,
    },
    { name },
  );
  if (errors.length > 0 && __ENV.DEBUG) {
    console.warn(`${name}: ${errors.map((e) => e.message).join('; ')}`);
  }
  return body?.data ?? null;
};

export const graphql = (
  session: Session,
  name: string,
  variables?: Record<string, unknown>,
): Record<string, unknown> | null => {
  const request = graphqlRequest(session, { name, variables });
  return record(
    name,
    http.post(
      request.url,
      request.body,
      request.params,
    ) as RefinedResponse<'text'>,
  );
};

/** Parallel calls, like a page's `Promise.all` during SSR. */
export const graphqlBatch = (
  session: Session,
  calls: GraphqlCall[],
): Array<Record<string, unknown> | null> => {
  const responses = http.batch(
    calls.map((call) => {
      const request = graphqlRequest(session, call);
      return [request.method, request.url, request.body, request.params] as [
        string,
        string,
        string,
        typeof request.params,
      ];
    }),
  );
  return responses.map((response, index) =>
    record(
      (calls[index] as GraphqlCall).name,
      response as RefinedResponse<'text'>,
    ),
  );
};

const restGet = (session: Session, path: string, name: string) => {
  const response = http.get(`${API_URL}${path}`, {
    headers: headersFor(session),
    tags: { name, kind: 'auth' },
  });
  if (response.status === 429) {
    rateLimited.add(1, { name });
  }
  check(response, { [`${name} → 200`]: (r) => r.status === 200 }, { name });
  return response;
};

/**
 * What every authenticated SSR render calls before its page queries:
 * `requireAuth()` (Better Auth get-session) and the terms gate.
 */
const ssrGuards = (session: Session) => {
  restGet(session, '/api/auth/get-session', 'get-session');
  restGet(session, '/legal/terms/status', 'terms-status');
};

const renderPage = (session: Session, path: string) => {
  const cookies = [`caluno.locale=${LOCALE}`];
  if (session.cookie) {
    cookies.push(`${SESSION_COOKIE_NAME}=${session.cookie}`);
  }
  const name = `page ${path || '/'}`;
  const response = http.get(`${WEB_URL}/${LOCALE}${path}`, {
    headers: { cookie: cookies.join('; ') },
    redirects: 0,
    tags: { name, kind: 'page' },
  });
  check(response, { [`${name} → 200`]: (r) => r.status === 200 }, { name });
};

/**
 * A page load. With WEB_URL set it renders the real Next.js page (which makes
 * the SSR calls itself) and returns null; otherwise it replays the page's SSR
 * calls straight against the API.
 */
export const view = <T>(
  session: Session,
  path: string,
  ssrCalls: () => T,
): T | null => {
  if (WEB_URL) {
    renderPage(session, path);
    return null;
  }
  if (session.cookie) {
    ssrGuards(session);
  }
  return ssrCalls();
};

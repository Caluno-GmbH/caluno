/**
 * Pure helpers for logging Next.js request errors to the frontend pino
 * logger (stdout → Loki). Kept free of Sentry/Next imports so unit tests
 * can exercise the payload shape without pulling the instrumentation
 * runtime.
 *
 * Query strings are stripped — same PII policy as the backend's
 * `sanitizeUrl` in pino-http options.
 */

/** React's generic message when an RSC/HTML stream destination closes mid-pipe. */
const DESTINATION_STREAM_CLOSED_EARLY = 'The destination stream closed early.';

const NEXT_CONTROL_FLOW_DIGEST_PREFIXES = [
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'NEXT_HTTP_ERROR_FALLBACK',
] as const;

/**
 * Client disconnect / cancelled RSC flight — expected lifecycle, not a
 * server failure. Next's own `isAbortError` only matches `AbortError` and
 * `ResponseAborted` by name; React still synthesises a plain `Error` with
 * this message on some abort paths (vercel/next.js#96704).
 */
export function isBenignClientAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  if (name === 'AbortError' || name === 'ResponseAborted') {
    return true;
  }

  const message = 'message' in error ? String(error.message) : '';
  return message === DESTINATION_STREAM_CLOSED_EARLY;
}

/** Next.js navigation / HTTP-fallback control-flow signals (by digest). */
export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== 'string') return false;
  return NEXT_CONTROL_FLOW_DIGEST_PREFIXES.some((prefix) =>
    digest.startsWith(prefix),
  );
}

/**
 * Errors that must not create Loki / Sentry request-failure noise:
 * client aborts and Next redirect/notFound signals.
 *
 * GraphQL UNAUTHENTICATED is intentionally *not* skipped: a successful
 * login redirect surfaces as `NEXT_REDIRECT` (filtered above). A bare
 * UNAUTHENTICATED DataError means redirect failed and should alert.
 */
export function isBenignRequestError(error: unknown): boolean {
  return isBenignClientAbortError(error) || isNextControlFlowError(error);
}

export function sanitizeRequestPath(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

export type RequestErrorLogRequest = {
  path: string;
  method: string;
};

export type RequestErrorLogContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export function buildRequestErrorLogFields(
  error: unknown,
  request: RequestErrorLogRequest,
  context: RequestErrorLogContext,
): {
  err: unknown;
  method: string;
  path: string;
  routePath: string;
  routeType: string;
  routerKind: string;
} {
  return {
    err: error,
    method: request.method,
    path: sanitizeRequestPath(request.path),
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  };
}

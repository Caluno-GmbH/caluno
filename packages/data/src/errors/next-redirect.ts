import { isForbiddenDataError, isUnauthenticatedDataError } from './data-error';

/**
 * Next.js `redirect()` throws an Error whose `digest` starts with this.
 * React Query stores that error. `shouldThrowRedirectError` is the
 * `throwOnError` predicate that rethrows it during render (queries and
 * mutations, not only suspense), and `shouldRetryQuery` keeps it from
 * being retried.
 */
const NEXT_REDIRECT_DIGEST_PREFIX = 'NEXT_REDIRECT';

export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === 'string' && digest.startsWith(NEXT_REDIRECT_DIGEST_PREFIX)
  );
}

/**
 * Mirrors `retry: 1`, but a redirect and an auth rejection are terminal —
 * the same session gets the same UNAUTHENTICATED / FORBIDDEN on retry.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (
    isNextRedirectError(error) ||
    isUnauthenticatedDataError(error) ||
    isForbiddenDataError(error)
  ) {
    return false;
  }
  return failureCount < 1;
}

/**
 * `useQuery` / `useMutation` only surface an error to Next's redirect
 * boundary when `throwOnError` returns true. A stored `NEXT_REDIRECT`
 * never navigates.
 */
export function shouldThrowRedirectError(error: unknown): boolean {
  return isNextRedirectError(error);
}

/**
 * `.catch` handler for an imperative call (`mutateAsync`) whose redirect is
 * already being rethrown during render. Returns a promise that never settles
 * for a redirect, so the caller's error handling does not run; any other
 * error is rethrown.
 */
export function swallowNextRedirect(error: unknown): Promise<never> {
  if (isNextRedirectError(error)) return new Promise<never>(() => {});
  throw error;
}

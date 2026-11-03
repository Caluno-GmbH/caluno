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

/** Mirrors `retry: 1`, but a login/forbidden redirect is terminal. */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  return !isNextRedirectError(error) && failureCount < 1;
}

/**
 * `useQuery` / `useMutation` only surface an error to Next's redirect
 * boundary when `throwOnError` returns true. A stored `NEXT_REDIRECT`
 * never navigates.
 */
export function shouldThrowRedirectError(error: unknown): boolean {
  return isNextRedirectError(error);
}

/**
 * Next.js `redirect()` throws an Error whose `digest` starts with this.
 * React Query stores that error and rethrows it during render; recognizing
 * it here keeps the redirect from being retried or left in query state.
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

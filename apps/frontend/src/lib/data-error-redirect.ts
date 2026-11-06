import { buildSignInHref } from './sign-in-redirect';

/**
 * Marks a login redirect caused by a client GraphQL UNAUTHENTICATED. The
 * login page then shows its form instead of bouncing a still-valid frontend
 * session straight back — which would loop when the API rejects the session
 * the frontend accepts (cookie scope, revoked session, cookie cache).
 */
export const SESSION_EXPIRED_REASON = 'session-expired';

/** Login target for a client UNAUTHENTICATED, returning to `pathname`. */
export function resolveSessionExpiredRedirect(pathname: string | null): string {
  const href = buildSignInHref(pathname);
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}reason=${SESSION_EXPIRED_REASON}`;
}

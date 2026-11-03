import { buildSignInHref } from './sign-in-redirect';

/**
 * `handleServerDataClientError` navigates to `/login` or `/unauthorized`.
 * The login target keeps the page the person was opening, so signing in
 * returns them there.
 */
export function resolveDataErrorRedirect(
  path: string,
  pathname: string | null,
): string {
  return path === '/login' ? buildSignInHref(pathname) : path;
}

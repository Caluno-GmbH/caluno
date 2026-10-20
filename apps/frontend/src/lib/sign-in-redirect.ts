import { resolveNextPath } from './terms-next-path';

export function buildSignInHref(
  requestPath: string | null | undefined,
): string {
  const next = resolveNextPath(requestPath);

  return next === '/'
    ? '/login'
    : `/login?redirectTo=${encodeURIComponent(next)}`;
}

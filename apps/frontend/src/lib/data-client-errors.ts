import {
  type DataError,
  isForbiddenDataError,
  isUnauthenticatedDataError,
} from '@repo/data';

export interface HandleServerDataClientErrorOptions {
  redirectOnUnauthenticated?: boolean;
}

/**
 * `navigate` is contractually `never` — Next's `redirect()` always throws a
 * `NEXT_REDIRECT` control-flow error. If it ever returns instead (a bug in
 * `redirect()` itself, or a caller swapping in a non-throwing stub), falling
 * through silently would surface the *original* DataError, which is
 * indistinguishable in the logs from "no redirect was warranted". Make that
 * failure mode loud instead.
 */
function navigateOrThrow(
  navigate: (path: string) => never,
  path: string,
): never {
  navigate(path);
  throw new Error(
    `handleServerDataClientError: navigate('${path}') returned instead of throwing — redirect did not fire`,
  );
}

export function handleServerDataClientError(
  error: DataError,
  options: HandleServerDataClientErrorOptions,
  navigate: (path: string) => never,
): void {
  if (isForbiddenDataError(error)) {
    navigateOrThrow(
      navigate,
      `/unauthorized?message=${encodeURIComponent(error.message)}`,
    );
  }
  if (
    isUnauthenticatedDataError(error) &&
    options.redirectOnUnauthenticated !== false
  ) {
    // Must match the real auth route (`/[locale]/login`), not `/auth/login`.
    navigateOrThrow(navigate, '/login');
  }
  throw error;
}

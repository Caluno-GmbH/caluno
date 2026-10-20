import {
  type DataError,
  isForbiddenDataError,
  isUnauthenticatedDataError,
} from '@repo/data';

export interface HandleServerDataClientErrorOptions {
  redirectOnUnauthenticated?: boolean;
}

export function handleServerDataClientError(
  error: DataError,
  options: HandleServerDataClientErrorOptions,
  navigate: (path: string) => never,
): void {
  if (isForbiddenDataError(error)) {
    navigate(`/unauthorized?message=${encodeURIComponent(error.message)}`);
  }
  if (
    isUnauthenticatedDataError(error) &&
    options.redirectOnUnauthenticated !== false
  ) {
    // Must match the real auth route (`/[locale]/login`), not `/auth/login`.
    navigate('/login');
  }
  throw error;
}

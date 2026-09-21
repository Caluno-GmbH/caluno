import {
  type DataError,
  ForbiddenDataError,
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
  if (error instanceof ForbiddenDataError) {
    navigate(`/unauthorized?message=${encodeURIComponent(error.message)}`);
  }
  if (
    isUnauthenticatedDataError(error) &&
    options.redirectOnUnauthenticated !== false
  ) {
    navigate('/auth/login');
  }
  throw error;
}

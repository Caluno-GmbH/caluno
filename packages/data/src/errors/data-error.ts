export class DataError extends Error {
  constructor(
    message: string,
    public readonly options?: {
      cause?: unknown;
      code?: string;
      statusCode?: number;
    },
  ) {
    super(message);
    this.name = 'DataError';
  }
}

const UNAUTHENTICATED_CODES = new Set(['UNAUTHENTICATED', 'UNAUTHORIZED']);

/**
 * Read `options` from a real `DataError` or a duck-typed stand-in.
 *
 * Next SSR can end up with two copies of `@repo/data` in one bundle (same
 * dual-package hazard as sonner / next-themes). `instanceof DataError` then
 * fails even when the value is clearly a DataError — so callers that gate on
 * `instanceof` alone never redirect and Next logs `⨯ Error [DataError]`.
 */
function readDataErrorOptions(
  error: unknown,
): { code?: string; statusCode?: number } | undefined {
  if (!error || typeof error !== 'object') return undefined;

  if (error instanceof DataError) {
    return error.options;
  }

  if (!('options' in error)) return undefined;
  const options = (error as { options?: unknown }).options;
  if (!options || typeof options !== 'object') return undefined;

  // Require an Error-shaped value so plain `{ options: { code } }` objects
  // do not match.
  const name = 'name' in error ? (error as { name?: unknown }).name : undefined;
  const message =
    'message' in error ? (error as { message?: unknown }).message : undefined;
  if (typeof name !== 'string' || typeof message !== 'string') {
    return undefined;
  }

  return options as { code?: string; statusCode?: number };
}

/**
 * True when the backend rejected the request because there is no valid
 * session. The backend auth guard does not always use the Apollo
 * `UNAUTHENTICATED` code (it may send `UNAUTHORIZED` or only an HTTP 401),
 * so match any of these signals. 403s are translated to `ForbiddenDataError`
 * upstream and never reach this check as unauthenticated.
 *
 * Matches both real `DataError` instances and duck-typed copies (SSR
 * dual-package), so login redirects still fire in production.
 */
export function isUnauthenticatedDataError(error: unknown): boolean {
  const options = readDataErrorOptions(error);
  if (!options) return false;
  const { code, statusCode } = options;
  return (
    (code !== undefined && UNAUTHENTICATED_CODES.has(code)) ||
    statusCode === 401
  );
}

export function isNotFoundDataError(error: unknown): boolean {
  return readDataErrorOptions(error)?.code === 'NOT_FOUND';
}

export function isForbiddenDataError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (readDataErrorOptions(error)?.code === 'FORBIDDEN') return true;
  // ForbiddenDataError sets name even when options are missing on a copy.
  return (
    'name' in error &&
    (error as { name?: unknown }).name === 'ForbiddenDataError'
  );
}

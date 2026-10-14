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
 * True when the backend rejected the request because there is no valid
 * session. The backend auth guard does not always use the Apollo
 * `UNAUTHENTICATED` code (it may send `UNAUTHORIZED` or only an HTTP 401),
 * so match any of these signals. 403s are translated to `ForbiddenDataError`
 * upstream and never reach this check as unauthenticated.
 */
export function isUnauthenticatedDataError(error: unknown): boolean {
  if (!(error instanceof DataError)) return false;
  const { code, statusCode } = error.options ?? {};
  return (
    (code !== undefined && UNAUTHENTICATED_CODES.has(code)) ||
    statusCode === 401
  );
}

export function isNotFoundDataError(error: unknown): boolean {
  return error instanceof DataError && error.options?.code === 'NOT_FOUND';
}

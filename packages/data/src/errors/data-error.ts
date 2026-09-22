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

export function isUnauthenticatedDataError(error: unknown): boolean {
  return (
    error instanceof DataError && error.options?.code === 'UNAUTHENTICATED'
  );
}

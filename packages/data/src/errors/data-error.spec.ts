import { describe, expect, it } from 'bun:test';
import {
  DataError,
  isForbiddenDataError,
  isNotFoundDataError,
  isUnauthenticatedDataError,
} from './data-error';
import { ForbiddenDataError } from './forbidden-data-error';

/** Simulates a duplicated DataError class (Next SSR dual-package hazard). */
class OtherDataError extends Error {
  name = 'DataError';
  constructor(
    message: string,
    public readonly options?: { code?: string; statusCode?: number },
  ) {
    super(message);
  }
}

describe('isUnauthenticatedDataError', () => {
  it('returns true for UNAUTHENTICATED DataError', () => {
    const error = new DataError('Unauthorized', { code: 'UNAUTHENTICATED' });
    expect(isUnauthenticatedDataError(error)).toBe(true);
  });

  it('returns true for UNAUTHORIZED DataError', () => {
    const error = new DataError('Unauthorized', { code: 'UNAUTHORIZED' });
    expect(isUnauthenticatedDataError(error)).toBe(true);
  });

  it('returns true for a DataError with HTTP 401 and no code', () => {
    const error = new DataError('Unauthorized', { statusCode: 401 });
    expect(isUnauthenticatedDataError(error)).toBe(true);
  });

  it('returns true for a duck-typed UNAUTHENTICATED error (cross-bundle)', () => {
    const error = new OtherDataError('Unauthorized', {
      code: 'UNAUTHENTICATED',
    });
    expect(error instanceof DataError).toBe(false);
    expect(isUnauthenticatedDataError(error)).toBe(true);
  });

  it('returns false for other DataError codes', () => {
    const error = new DataError('Forbidden', { code: 'FORBIDDEN' });
    expect(isUnauthenticatedDataError(error)).toBe(false);
  });

  it('returns false for non-DataError values', () => {
    expect(isUnauthenticatedDataError(new Error('nope'))).toBe(false);
    expect(isUnauthenticatedDataError(null)).toBe(false);
    expect(
      isUnauthenticatedDataError({ options: { code: 'UNAUTHENTICATED' } }),
    ).toBe(false);
  });
});

describe('isNotFoundDataError', () => {
  it('returns true for NOT_FOUND DataError', () => {
    expect(
      isNotFoundDataError(new DataError('missing', { code: 'NOT_FOUND' })),
    ).toBe(true);
  });

  it('returns true for a duck-typed NOT_FOUND error', () => {
    const error = new OtherDataError('missing', { code: 'NOT_FOUND' });
    expect(error instanceof DataError).toBe(false);
    expect(isNotFoundDataError(error)).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(
      isNotFoundDataError(new DataError('nope', { code: 'FORBIDDEN' })),
    ).toBe(false);
    expect(isNotFoundDataError(null)).toBe(false);
  });
});

describe('isForbiddenDataError', () => {
  it('returns true for ForbiddenDataError', () => {
    expect(isForbiddenDataError(new ForbiddenDataError('No access'))).toBe(
      true,
    );
  });

  it('returns true for a duck-typed FORBIDDEN error', () => {
    const error = new OtherDataError('No access', { code: 'FORBIDDEN' });
    expect(error instanceof DataError).toBe(false);
    expect(isForbiddenDataError(error)).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(
      isForbiddenDataError(
        new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      ),
    ).toBe(false);
    expect(isForbiddenDataError(null)).toBe(false);
  });
});

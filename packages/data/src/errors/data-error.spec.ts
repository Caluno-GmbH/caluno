import { describe, expect, it } from 'bun:test';
import { DataError, isUnauthenticatedDataError } from './data-error';

describe('isUnauthenticatedDataError', () => {
  it('returns true for UNAUTHENTICATED DataError', () => {
    const error = new DataError('Unauthorized', { code: 'UNAUTHENTICATED' });
    expect(isUnauthenticatedDataError(error)).toBe(true);
  });

  it('returns false for other DataError codes', () => {
    const error = new DataError('Forbidden', { code: 'FORBIDDEN' });
    expect(isUnauthenticatedDataError(error)).toBe(false);
  });

  it('returns false for non-DataError values', () => {
    expect(isUnauthenticatedDataError(new Error('nope'))).toBe(false);
    expect(isUnauthenticatedDataError(null)).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { DataError } from './data-error';
import { ForbiddenDataError } from './forbidden-data-error';
import {
  isNextRedirectError,
  shouldRetryQuery,
  shouldThrowRedirectError,
  swallowNextRedirect,
} from './next-redirect';

describe('isNextRedirectError', () => {
  it('matches a Next redirect digest', () => {
    expect(
      isNextRedirectError({
        digest: 'NEXT_REDIRECT;replace;/en/login;307;',
      }),
    ).toBe(true);
  });

  it('does not match other control-flow digests or DataErrors', () => {
    expect(isNextRedirectError({ digest: 'NEXT_NOT_FOUND' })).toBe(false);
    expect(isNextRedirectError(new Error('Unauthorized'))).toBe(false);
    expect(isNextRedirectError(null)).toBe(false);
  });
});

describe('shouldRetryQuery', () => {
  it('retries the first failure once', () => {
    expect(shouldRetryQuery(0, new Error('nope'))).toBe(true);
    expect(shouldRetryQuery(1, new Error('nope'))).toBe(false);
  });

  it('does not retry a redirect', () => {
    const redirect = { digest: 'NEXT_REDIRECT;replace;/en/login;307;' };
    expect(shouldRetryQuery(0, redirect)).toBe(false);
  });

  it('does not retry an auth rejection', () => {
    expect(
      shouldRetryQuery(
        0,
        new DataError('No session', { code: 'UNAUTHENTICATED' }),
      ),
    ).toBe(false);
    expect(
      shouldRetryQuery(0, new DataError('Expired', { statusCode: 401 })),
    ).toBe(false);
    expect(shouldRetryQuery(0, new ForbiddenDataError('No access'))).toBe(
      false,
    );
  });

  it('retries other DataErrors once', () => {
    expect(
      shouldRetryQuery(
        0,
        new DataError('Boom', { code: 'INTERNAL_SERVER_ERROR' }),
      ),
    ).toBe(true);
  });
});

describe('shouldThrowRedirectError', () => {
  it('rethrows a redirect so useQuery and useMutation navigate', () => {
    expect(
      shouldThrowRedirectError({
        digest: 'NEXT_REDIRECT;replace;/en/login;307;',
      }),
    ).toBe(true);
  });

  it('leaves a DataError in query state', () => {
    expect(shouldThrowRedirectError(new Error('Unauthorized'))).toBe(false);
    expect(shouldThrowRedirectError(null)).toBe(false);
  });
});

describe('swallowNextRedirect', () => {
  it('never settles for a redirect', async () => {
    const pending = Symbol('pending');
    const result = await Promise.race([
      swallowNextRedirect({ digest: 'NEXT_REDIRECT;replace;/en/login;307;' }),
      new Promise((resolve) => setTimeout(() => resolve(pending), 10)),
    ]);
    expect(result).toBe(pending);
  });

  it('rethrows any other error', () => {
    const error = new Error('Forbidden');
    expect(() => swallowNextRedirect(error)).toThrow(error);
  });
});

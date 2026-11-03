import { describe, expect, it } from 'bun:test';
import { isNextRedirectError, shouldRetryQuery } from './next-redirect';

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
});

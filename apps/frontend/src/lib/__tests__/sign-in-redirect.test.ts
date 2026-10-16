import { describe, expect, it } from 'bun:test';
import { buildSignInHref } from '../sign-in-redirect';

describe('buildSignInHref', () => {
  it('preserves the requested admin deep link as redirectTo', () => {
    expect(
      buildSignInHref('/de/admin/org-1/shifts/shift-1/instances/instance-1'),
    ).toBe(
      '/login?redirectTo=%2Fadmin%2Forg-1%2Fshifts%2Fshift-1%2Finstances%2Finstance-1',
    );
  });

  it('drops the locale prefix from the redirectTo', () => {
    expect(buildSignInHref('/en/my-shifts')).toBe(
      '/login?redirectTo=%2Fmy-shifts',
    );
  });

  it('keeps rooted relative paths without a locale', () => {
    expect(buildSignInHref('/my-shifts')).toBe(
      '/login?redirectTo=%2Fmy-shifts',
    );
  });

  it('collapses the root and missing paths to a bare /login', () => {
    expect(buildSignInHref('/')).toBe('/login');
    expect(buildSignInHref('/en')).toBe('/login');
    expect(buildSignInHref(null)).toBe('/login');
    expect(buildSignInHref(undefined)).toBe('/login');
  });

  it('never points at sign-up', () => {
    expect(buildSignInHref('/admin/org-1')).not.toContain('/signup');
  });

  it('rejects unsafe redirect targets', () => {
    expect(buildSignInHref('//evil.example')).toBe('/login');
    expect(buildSignInHref('/en//evil.example')).toBe('/login');
  });
});

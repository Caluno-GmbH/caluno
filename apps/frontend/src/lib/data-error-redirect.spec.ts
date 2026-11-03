import { describe, expect, it } from 'bun:test';
import { resolveDataErrorRedirect } from './data-error-redirect';

describe('resolveDataErrorRedirect', () => {
  it('sends UNAUTHENTICATED to login with the current page', () => {
    expect(
      resolveDataErrorRedirect(
        '/login',
        '/admin/org-1/shifts/shift-1/instances/instance-1',
      ),
    ).toBe(
      '/login?redirectTo=%2Fadmin%2Forg-1%2Fshifts%2Fshift-1%2Finstances%2Finstance-1',
    );
  });

  it('leaves the forbidden target unchanged', () => {
    expect(
      resolveDataErrorRedirect('/unauthorized?message=No%20access', '/admin'),
    ).toBe('/unauthorized?message=No%20access');
  });
});

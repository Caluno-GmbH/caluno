import { describe, expect, it } from 'bun:test';
import { resolveSessionExpiredRedirect } from './data-error-redirect';

describe('resolveSessionExpiredRedirect', () => {
  it('sends UNAUTHENTICATED to login with the current page and reason', () => {
    expect(
      resolveSessionExpiredRedirect(
        '/admin/org-1/shifts/shift-1/instances/instance-1',
      ),
    ).toBe(
      '/login?redirectTo=%2Fadmin%2Forg-1%2Fshifts%2Fshift-1%2Finstances%2Finstance-1&reason=session-expired',
    );
  });

  it('adds the reason when there is no page to return to', () => {
    expect(resolveSessionExpiredRedirect('/')).toBe(
      '/login?reason=session-expired',
    );
  });
});

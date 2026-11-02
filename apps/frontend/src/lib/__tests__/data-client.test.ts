import { describe, expect, it, mock } from 'bun:test';
import { DataError, ForbiddenDataError } from '@repo/data';
import { handleServerDataClientError } from '../data-client-errors';

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

describe('handleServerDataClientError', () => {
  it('redirects to login on UNAUTHENTICATED by default', () => {
    const navigate = mock((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });

    expect(() =>
      handleServerDataClientError(
        new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
        {},
        navigate,
      ),
    ).toThrow('NEXT_REDIRECT:/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('redirects to login for a duck-typed UNAUTHENTICATED error', () => {
    const navigate = mock((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
    const error = new OtherDataError('Unauthorized', {
      code: 'UNAUTHENTICATED',
    });
    expect(error instanceof DataError).toBe(false);

    expect(() =>
      handleServerDataClientError(error as unknown as DataError, {}, navigate),
    ).toThrow('NEXT_REDIRECT:/login');
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('throws UNAUTHENTICATED when redirectOnUnauthenticated is false', () => {
    const navigate = mock((_path: string) => {
      throw new Error('NEXT_REDIRECT');
    });
    const error = new DataError('Unauthorized', { code: 'UNAUTHENTICATED' });

    expect(() =>
      handleServerDataClientError(
        error,
        { redirectOnUnauthenticated: false },
        navigate,
      ),
    ).toThrow(error);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to unauthorized on FORBIDDEN', () => {
    const navigate = mock((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });

    expect(() =>
      handleServerDataClientError(
        new ForbiddenDataError('No access'),
        {},
        navigate,
      ),
    ).toThrow('NEXT_REDIRECT:/unauthorized?message=No%20access');
    expect(navigate).toHaveBeenCalledWith('/unauthorized?message=No%20access');
  });

  it('surfaces a loud contract-violation error if navigate returns instead of throwing (UNAUTHENTICATED)', () => {
    // `navigate` is typed `never` — Next's `redirect()` always throws. If it
    // doesn't (bug, or a misbehaving stub), the original DataError must not
    // be the thing that surfaces: that looks identical in the logs to "no
    // redirect was warranted", hiding a real failed-redirect bug.
    const navigate = mock((_path: string) => undefined as never);
    const error = new DataError('Unauthorized', { code: 'UNAUTHENTICATED' });

    expect(() => handleServerDataClientError(error, {}, navigate)).toThrow(
      /navigate\('\/login'\) returned instead of throwing/,
    );
  });

  it('surfaces a loud contract-violation error if navigate returns instead of throwing (FORBIDDEN)', () => {
    const navigate = mock((_path: string) => undefined as never);

    expect(() =>
      handleServerDataClientError(
        new ForbiddenDataError('No access'),
        {},
        navigate,
      ),
    ).toThrow(
      /navigate\('\/unauthorized\?message=No%20access'\) returned instead of throwing/,
    );
  });
});

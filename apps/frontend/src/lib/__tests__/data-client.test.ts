import { describe, expect, it, mock } from 'bun:test';
import { DataError, ForbiddenDataError } from '@repo/data';
import { handleServerDataClientError } from '../data-client-errors';

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
    ).toThrow('NEXT_REDIRECT:/auth/login');
    expect(navigate).toHaveBeenCalledWith('/auth/login');
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
});

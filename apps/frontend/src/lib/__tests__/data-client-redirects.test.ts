import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  type DataClient,
  type DataClientConfig,
  DataError,
  ForbiddenDataError,
} from '@repo/data';
import { createGetDataClient } from '../data-client-core';

let onError: DataClientConfig['onError'];
const createDataClientMock = mock((config: DataClientConfig) => {
  onError = config.onError;
  return {} as DataClient;
});
const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('NEXT_REDIRECT');
});
let requestHeaders = new Headers();
const getDataClient = createGetDataClient({
  createDataClient: createDataClientMock,
  getLocale: async () => 'de',
  getHeaders: async () => requestHeaders,
  redirect: redirectMock,
});

async function expectErrorRedirect(
  error: DataError,
  expected: { href: string; locale: string },
  options?: { locale: 'en' | 'de' },
) {
  await getDataClient(options);
  expect(onError).toBeDefined();
  expect(() => onError?.(error)).toThrow('NEXT_REDIRECT');
  expect(redirectMock).toHaveBeenCalledWith(expected);
}

describe('getDataClient authentication redirects', () => {
  beforeEach(() => {
    onError = undefined;
    requestHeaders = new Headers();
    redirectMock.mockClear();
  });

  it('prefers an explicit locale for unauthenticated redirects', async () => {
    await expectErrorRedirect(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      { href: '/login?reason=session-expired', locale: 'en' },
      { locale: 'en' },
    );
  });

  it('uses the request locale for unauthenticated redirects', async () => {
    await expectErrorRedirect(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      { href: '/login?reason=session-expired', locale: 'de' },
    );
  });

  it('returns to the requested page after login', async () => {
    requestHeaders = new Headers({ 'x-pathname': '/de/admin/org-1/shifts' });
    await expectErrorRedirect(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      {
        href: '/login?redirectTo=%2Fadmin%2Forg-1%2Fshifts&reason=session-expired',
        locale: 'de',
      },
    );
  });

  it('uses the request locale for forbidden redirects', async () => {
    await expectErrorRedirect(new ForbiddenDataError('No access'), {
      href: '/unauthorized?message=No%20access',
      locale: 'de',
    });
  });
});

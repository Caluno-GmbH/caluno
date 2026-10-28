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
const getDataClient = createGetDataClient({
  createDataClient: createDataClientMock,
  getLocale: async () => 'de',
  getHeaders: async () => new Headers(),
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
    redirectMock.mockClear();
  });

  it('prefers an explicit locale for unauthenticated redirects', async () => {
    await expectErrorRedirect(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      { href: '/login', locale: 'en' },
      { locale: 'en' },
    );
  });

  it('uses the request locale for unauthenticated redirects', async () => {
    await expectErrorRedirect(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      { href: '/login', locale: 'de' },
    );
  });

  it('uses the request locale for forbidden redirects', async () => {
    await expectErrorRedirect(new ForbiddenDataError('No access'), {
      href: '/unauthorized?message=No%20access',
      locale: 'de',
    });
  });
});

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  DataError,
  ForbiddenDataError,
  isForbiddenDataError,
  isUnauthenticatedDataError,
  LOCALE_HEADER,
} from '@repo/data';

type ErrorHandler = (error: DataError) => void;

let onError: ErrorHandler | undefined;
const createDataClientMock = mock((config: { onError?: ErrorHandler }) => {
  onError = config.onError;
  return {};
});
const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('NEXT_REDIRECT');
});

mock.module('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

mock.module('next-intl/server', () => ({
  getLocale: async () => 'de',
  getTranslations: async () => (key: string) => key,
}));

mock.module('@/i18n/navigation', () => ({
  redirect: redirectMock,
}));

mock.module('next/navigation', () => ({
  redirect: () => {
    throw new Error('UNLOCALIZED_REDIRECT');
  },
}));

mock.module('@repo/data', () => ({
  DataError,
  ForbiddenDataError,
  isForbiddenDataError,
  isUnauthenticatedDataError,
  LOCALE_HEADER,
  createDataClient: createDataClientMock,
}));

const { getDataClient } = await import('../data-client');

afterAll(() => {
  mock.restore();
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

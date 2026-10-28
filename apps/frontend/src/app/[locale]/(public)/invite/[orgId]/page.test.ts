import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { JoinStatus } from '@repo/data';

let joinStatus = JoinStatus.Joined;
let pendingRedirect = '/admin/org-1';
const redirectMock = mock((_args: { href: string; locale: string }) => {
  throw new Error('NEXT_REDIRECT');
});

mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'pending_redirect' ? { value: pendingRedirect } : undefined,
  }),
}));

mock.module('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

mock.module('@/i18n/navigation', () => ({
  redirect: redirectMock,
}));

mock.module('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('UNLOCALIZED_REDIRECT');
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith('NEXT_')) {
      throw error;
    }
  },
}));

mock.module('@/lib/auth-server', () => ({
  isAuthenticated: async () => true,
}));

mock.module('@/lib/data-client', () => ({
  getDataClient: async () => ({
    publicOrganizationUnit: {
      findById: async () => ({ id: 'org-1', name: 'Organization' }),
    },
    membershipRequest: {
      join: async () => ({ status: joinStatus }),
    },
  }),
}));

mock.module('./components/join-error', () => ({
  JoinError: () => null,
}));
mock.module('./components/request-pending', () => ({
  RequestPending: () => null,
}));
mock.module('./components/request-rejected', () => ({
  RequestRejected: () => null,
}));

const { default: InvitePage } = await import('./page');

async function expectLocalizedRedirect(expected: {
  href: string;
  locale: string;
}) {
  await expect(
    InvitePage({
      params: Promise.resolve({ locale: 'en', orgId: 'org-1' }),
    }),
  ).rejects.toThrow('NEXT_REDIRECT');
  expect(redirectMock).toHaveBeenCalledWith(expected);
}

describe('InvitePage redirects', () => {
  beforeEach(() => {
    pendingRedirect = '/admin/org-1';
    redirectMock.mockClear();
  });

  it('preserves the locale and safe return path for a joined user', async () => {
    joinStatus = JoinStatus.Joined;
    await expectLocalizedRedirect({ href: '/admin/org-1', locale: 'en' });
  });

  it('strips a matching locale prefix from the return path', async () => {
    joinStatus = JoinStatus.Joined;
    pendingRedirect = '/en/admin/org-1';
    await expectLocalizedRedirect({ href: '/admin/org-1', locale: 'en' });
  });

  it('replaces a different locale prefix with the active locale', async () => {
    joinStatus = JoinStatus.Joined;
    pendingRedirect = '/de/admin/org-1';
    await expectLocalizedRedirect({ href: '/admin/org-1', locale: 'en' });
  });

  it('preserves the locale when required forms remain', async () => {
    joinStatus = JoinStatus.RequirementsNeeded;
    await expectLocalizedRedirect({
      href: '/join/org-1/forms',
      locale: 'en',
    });
  });
});

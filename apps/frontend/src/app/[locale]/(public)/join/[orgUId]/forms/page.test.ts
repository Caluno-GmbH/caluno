import { describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const notFoundMock = mock(() => {
  throw new Error('NEXT_NOT_FOUND');
});

mock.module('next/navigation', () => ({
  notFound: notFoundMock,
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith('NEXT_')) {
      throw error;
    }
  },
}));

mock.module('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

mock.module('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

mock.module('@/lib/auth-server', () => ({
  getSession: async () => ({ user: { id: 'user-1' } }),
}));

mock.module('@/lib/data-client', () => ({
  getDataClient: async () => ({
    publicOrganizationUnit: {
      findByIdWithRequiredForms: async () => {
        throw new DataError('missing', { code: 'NOT_FOUND' });
      },
    },
    user: {
      getMe: async () => ({}),
    },
    membershipRequest: {
      join: async () => null,
    },
  }),
}));

mock.module('@/domain/org-unit/components/org-page-header', () => ({
  OrgPageHeader: () => null,
}));

mock.module('./join-forms-client', () => ({
  JoinFormsClient: () => null,
}));

const { default: JoinFormsPage } = await import('./page');

describe('JoinFormsPage', () => {
  it('renders not found when the organization does not exist', async () => {
    await expect(
      JoinFormsPage({
        params: Promise.resolve({ locale: 'de', orgUId: 'missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

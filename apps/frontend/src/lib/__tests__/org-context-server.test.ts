import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const findMyAdminstrableOrganizationUnits = mock(async () => []);
const getDataClient = mock(async () => ({
  organization: { findMyAdminstrableOrganizationUnits },
}));

mock.module('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

mock.module('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: () => {
    throw new Error('REDIRECT');
  },
}));

mock.module('../data-client', () => ({
  getDataClient,
}));

const { isAnAdminstrator } = await import('../org-context-server');

afterAll(() => {
  mock.restore();
});

describe('isAnAdminstrator', () => {
  beforeEach(() => {
    findMyAdminstrableOrganizationUnits.mockClear();
    getDataClient.mockClear();
    findMyAdminstrableOrganizationUnits.mockResolvedValue([]);
  });

  it('returns false when administrable org lookup is unauthenticated', async () => {
    findMyAdminstrableOrganizationUnits.mockRejectedValue(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
    );

    await expect(isAnAdminstrator()).resolves.toBe(false);
    expect(getDataClient).toHaveBeenCalledWith({
      redirectOnUnauthenticated: false,
    });
  });

  it('returns true when the user has administrable org units', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
      {
        id: 'unit-1',
        slug: 'playground',
        name: 'Playground',
        parent: null,
        organization: {
          id: 'org-1',
          name: 'Playground Org',
          description: null,
          logoUrl: null,
          accountingEnabled: false,
        },
      },
    ]);

    await expect(isAnAdminstrator()).resolves.toBe(true);
  });
});

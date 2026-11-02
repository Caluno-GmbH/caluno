import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const findMyAdministrableOrganizationUnits = mock(async () => []);
const findAccessInfo = mock(async () => ({ isMember: false, unit: null }));
const getDataClient = mock(async () => ({
  organization: { findMyAdministrableOrganizationUnits },
  organizationUnit: { findAccessInfo },
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
  unstable_rethrow: (error: unknown) => {
    if (
      error instanceof Error &&
      (error.message === 'NOT_FOUND' || error.message === 'REDIRECT')
    ) {
      throw error;
    }
  },
}));

mock.module('../data-client', () => ({
  getDataClient,
}));

const { getMyAdministrableOrgUnits, isAnAdminstrator, requireOrgAccess } =
  await import('../org-context-server');

afterAll(() => {
  mock.restore();
});

interface RawUnitFixture {
  id: string;
  slug: string;
  name: string;
  parent: { id: string } | null;
  organization: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    accountingEnabled: boolean;
  };
}

function rootUnit(id: string, orgName: string): RawUnitFixture {
  return {
    id,
    slug: id,
    name: orgName,
    parent: null,
    organization: {
      id: `${id}-org`,
      name: orgName,
      description: null,
      logoUrl: null,
      accountingEnabled: false,
    },
  };
}

function nestedUnit(id: string, name: string, orgName: string): RawUnitFixture {
  return {
    ...rootUnit(id, orgName),
    name,
    parent: { id: `${id}-parent` },
  };
}

function resetMocks() {
  findMyAdministrableOrganizationUnits.mockClear();
  findAccessInfo.mockClear();
  getDataClient.mockClear();
  findMyAdministrableOrganizationUnits.mockResolvedValue([]);
  findAccessInfo.mockResolvedValue({ isMember: false, unit: null });
}

describe('isAnAdminstrator', () => {
  beforeEach(resetMocks);

  it('returns false when administrable org lookup is unauthenticated', async () => {
    findMyAdministrableOrganizationUnits.mockRejectedValue(
      new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
    );

    await expect(isAnAdminstrator()).resolves.toBe(false);
    expect(getDataClient).toHaveBeenCalledWith({
      redirectOnUnauthenticated: false,
    });
  });

  it('returns true when the user has administrable org units', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      rootUnit('unit-1', 'Playground'),
    ]);

    await expect(isAnAdminstrator()).resolves.toBe(true);
  });
});

describe('getMyAdministrableOrgUnits', () => {
  beforeEach(resetMocks);

  it('marks root units and keeps the raw unit name', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      rootUnit('unit-root', 'Playground'),
    ]);

    const units = await getMyAdministrableOrgUnits();

    expect(units).toEqual([
      expect.objectContaining({
        id: 'unit-root',
        name: 'Playground',
        isRoot: true,
        rootOrganizationName: undefined,
      }),
    ]);
  });

  it('marks nested units with the root organization name', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      nestedUnit('unit-sales', 'Sales', 'Playground'),
    ]);

    const units = await getMyAdministrableOrgUnits();

    expect(units).toEqual([
      expect.objectContaining({
        id: 'unit-sales',
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
      }),
    ]);
  });

  it('sorts by display label, not raw unit name', async () => {
    // Raw names sort "Alpha" before "Beta", but display labels sort
    // "Beta" before "Zoo › Alpha".
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      nestedUnit('unit-alpha', 'Alpha', 'Zoo'),
      rootUnit('unit-beta', 'Beta'),
    ]);

    const units = await getMyAdministrableOrgUnits();

    expect(units.map((unit) => unit.id)).toEqual(['unit-beta', 'unit-alpha']);
  });
});

const UUID_SALES = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001';
const UUID_ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002';
const UUID_ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003';
const UUID_LEGACY = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000004';
const UUID_UNKNOWN = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005';

describe('requireOrgAccess', () => {
  beforeEach(resetMocks);

  it('rejects non-UUID orgUId values with not-found before any DB call', async () => {
    await expect(requireOrgAccess('requirement-forms')).rejects.toThrow(
      'NOT_FOUND',
    );
    expect(findMyAdministrableOrganizationUnits).not.toHaveBeenCalled();
  });

  it('returns the administrable unit when it is in the user list', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      nestedUnit(UUID_SALES, 'Sales', 'Playground'),
    ]);

    const { org, organizations } = await requireOrgAccess(UUID_SALES);

    expect(org).toEqual(
      expect.objectContaining({
        id: UUID_SALES,
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
      }),
    );
    expect(organizations).toHaveLength(1);
    expect(findAccessInfo).not.toHaveBeenCalled();
  });

  it('redirects legacy organization ids to their root unit', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([
      rootUnit(UUID_ROOT, 'Playground'),
    ]);

    await expect(requireOrgAccess(UUID_LEGACY)).rejects.toThrow('REDIRECT');
  });

  it('builds the org from the unit lookup for non-admin members', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([]);
    findAccessInfo.mockResolvedValue({
      isMember: true,
      unit: {
        id: UUID_SALES,
        slug: 'sales',
        name: 'Sales',
        parent: { id: UUID_ROOT, name: 'Playground' },
        description: null,
        logoUrl: null,
        street: null,
        zipCode: null,
        city: null,
        legalRep: null,
        organizationId: UUID_ORG,
        organization: { id: UUID_ORG, name: 'Playground' },
      },
    });

    const { org } = await requireOrgAccess(UUID_SALES);

    expect(org).toEqual(
      expect.objectContaining({
        id: UUID_SALES,
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
        organizationId: UUID_ORG,
        accountingEnabled: false,
      }),
    );
  });

  it('marks fallback units without a parent as root', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([]);
    findAccessInfo.mockResolvedValue({
      isMember: true,
      unit: {
        id: UUID_ROOT,
        slug: 'playground',
        name: 'Playground',
        parent: null,
        description: null,
        logoUrl: null,
        street: null,
        zipCode: null,
        city: null,
        legalRep: null,
        organizationId: UUID_ORG,
        organization: { id: UUID_ORG, name: 'Playground' },
      },
    });

    const { org } = await requireOrgAccess(UUID_ROOT);

    expect(org).toEqual(
      expect.objectContaining({
        id: UUID_ROOT,
        name: 'Playground',
        isRoot: true,
        rootOrganizationName: undefined,
      }),
    );
  });

  it('redirects to unauthorized when the user is not a member', async () => {
    findMyAdministrableOrganizationUnits.mockResolvedValue([]);
    findAccessInfo.mockResolvedValue({ isMember: false, unit: null });

    await expect(requireOrgAccess(UUID_UNKNOWN)).rejects.toThrow('REDIRECT');
    expect(findAccessInfo).toHaveBeenCalledTimes(1);
  });

  it('redirects to unauthorized when membership is true but the unit lookup is null', async () => {
    // Defensive: isMember true with a null unit should still redirect, not
    // throw a TypeError on `unit.id`.
    findMyAdministrableOrganizationUnits.mockResolvedValue([]);
    findAccessInfo.mockResolvedValue({ isMember: true, unit: null });

    await expect(requireOrgAccess(UUID_UNKNOWN)).rejects.toThrow('REDIRECT');
  });
});

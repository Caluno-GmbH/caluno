import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataError } from '@repo/data';

const findMyAdminstrableOrganizationUnits = mock(async () => []);
const getMyMembershipStatus = mock(async () => false);
const findOrgUnitById = mock(async () => null);
const getDataClient = mock(async () => ({
  organization: { findMyAdminstrableOrganizationUnits },
  membership: { getMyMembershipStatus },
  organizationUnit: { findById: findOrgUnitById },
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
  findMyAdminstrableOrganizationUnits.mockClear();
  getMyMembershipStatus.mockClear();
  findOrgUnitById.mockClear();
  getDataClient.mockClear();
  findMyAdminstrableOrganizationUnits.mockResolvedValue([]);
  getMyMembershipStatus.mockResolvedValue(false);
  findOrgUnitById.mockResolvedValue(null);
}

describe('isAnAdminstrator', () => {
  beforeEach(resetMocks);

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
      rootUnit('unit-1', 'Playground'),
    ]);

    await expect(isAnAdminstrator()).resolves.toBe(true);
  });
});

describe('getMyAdministrableOrgUnits', () => {
  beforeEach(resetMocks);

  it('marks root units and keeps the raw unit name', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
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
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
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
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
      nestedUnit('unit-alpha', 'Alpha', 'Zoo'),
      rootUnit('unit-beta', 'Beta'),
    ]);

    const units = await getMyAdministrableOrgUnits();

    expect(units.map((unit) => unit.id)).toEqual(['unit-beta', 'unit-alpha']);
  });
});

describe('requireOrgAccess', () => {
  beforeEach(resetMocks);

  it('returns the administrable unit when it is in the user list', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
      nestedUnit('unit-sales', 'Sales', 'Playground'),
    ]);

    const { org, organizations } = await requireOrgAccess('unit-sales');

    expect(org).toEqual(
      expect.objectContaining({
        id: 'unit-sales',
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
      }),
    );
    expect(organizations).toHaveLength(1);
    expect(getMyMembershipStatus).not.toHaveBeenCalled();
  });

  it('redirects legacy organization ids to their root unit', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([
      rootUnit('unit-root', 'Playground'),
    ]);

    await expect(requireOrgAccess('org-1')).rejects.toThrow('REDIRECT');
  });

  it('builds the org from the unit lookup for non-admin members', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([]);
    getMyMembershipStatus.mockResolvedValue(true);
    findOrgUnitById.mockResolvedValue({
      id: 'unit-sales',
      slug: 'sales',
      name: 'Sales',
      parent: { id: 'unit-root', name: 'Playground' },
      description: null,
      logoUrl: null,
      street: null,
      zipCode: null,
      city: null,
      legalRep: null,
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Playground' },
    });

    const { org } = await requireOrgAccess('unit-sales');

    expect(org).toEqual(
      expect.objectContaining({
        id: 'unit-sales',
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
        organizationId: 'org-1',
        accountingEnabled: false,
      }),
    );
  });

  it('marks fallback units without a parent as root', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([]);
    getMyMembershipStatus.mockResolvedValue(true);
    findOrgUnitById.mockResolvedValue({
      id: 'unit-root',
      slug: 'playground',
      name: 'Playground',
      parent: null,
      description: null,
      logoUrl: null,
      street: null,
      zipCode: null,
      city: null,
      legalRep: null,
      organizationId: 'org-1',
      organization: { id: 'org-1', name: 'Playground' },
    });

    const { org } = await requireOrgAccess('unit-root');

    expect(org).toEqual(
      expect.objectContaining({
        id: 'unit-root',
        name: 'Playground',
        isRoot: true,
        rootOrganizationName: undefined,
      }),
    );
  });

  it('redirects to unauthorized when the user is not a member', async () => {
    findMyAdminstrableOrganizationUnits.mockResolvedValue([]);
    getMyMembershipStatus.mockResolvedValue(false);

    await expect(requireOrgAccess('unit-x')).rejects.toThrow('REDIRECT');
    expect(findOrgUnitById).not.toHaveBeenCalled();
  });
});

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { LAST_ORG_COOKIE, type MyOrganizationUnit } from '@repo/data';

const administrableUnits: MyOrganizationUnit[] = [];
let lastVisitedOrgId: string | null = null;

const findMyAdminstrableOrganizationUnits = mock(
  async () => administrableUnits,
);

mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === LAST_ORG_COOKIE && lastVisitedOrgId) {
        return { name, value: lastVisitedOrgId };
      }
      return undefined;
    },
  }),
}));

mock.module('../data-client', () => ({
  getDataClient: async () => ({
    organization: { findMyAdminstrableOrganizationUnits },
  }),
}));

const { resolvePostAuthDestination, resolveAdminDestination } = await import(
  '../routing'
);

function rootOrgUnit(id: string, organizationId: string): MyOrganizationUnit {
  return {
    id,
    slug: id,
    name: id,
    parent: null,
    description: null,
    logoUrl: null,
    address: null,
    zipCode: null,
    city: null,
    legalRep: null,
    organization: {
      id: organizationId,
      name: id,
      description: null,
      logoUrl: null,
      accountingEnabled: false,
    },
  };
}

const orgUnit = rootOrgUnit('org-unit-1', 'org-1');
const anotherOrgUnit = rootOrgUnit('org-unit-2', 'org-2');

afterAll(() => {
  mock.restore();
});

describe('routing', () => {
  describe('resolvePostAuthDestination', () => {
    beforeEach(() => {
      administrableUnits.length = 0;
      lastVisitedOrgId = null;
      findMyAdminstrableOrganizationUnits.mockClear();
    });

    it('returns / when the user has no accessible organization units', async () => {
      expect(await resolvePostAuthDestination()).toBe('/');
    });

    it('returns / when orgs exist but no last visited cookie is set', async () => {
      administrableUnits.push(orgUnit);

      expect(await resolvePostAuthDestination()).toBe('/');
    });

    it('returns /admin/{id} when last visited cookie matches an accessible org unit', async () => {
      administrableUnits.push(orgUnit);
      lastVisitedOrgId = orgUnit.id;

      expect(await resolvePostAuthDestination()).toBe('/admin/org-unit-1');
    });

    it('returns / when last visited cookie does not match an accessible org unit', async () => {
      administrableUnits.push(orgUnit);
      lastVisitedOrgId = 'other-org-unit';

      expect(await resolvePostAuthDestination()).toBe('/');
    });
  });

  describe('resolveAdminDestination', () => {
    beforeEach(() => {
      administrableUnits.length = 0;
      lastVisitedOrgId = null;
      findMyAdminstrableOrganizationUnits.mockClear();
    });

    it('Resolves to nowhere, when the user has no accessible organization units', async () => {
      expect(await resolveAdminDestination()).toBeNull();
    });

    it('Resolves to previously visited org unit, when last visited cookie matches an accessible org unit', async () => {
      administrableUnits.push(orgUnit);
      administrableUnits.push(anotherOrgUnit);

      lastVisitedOrgId = anotherOrgUnit.id;

      expect(await resolveAdminDestination()).toBe('/admin/org-unit-2');
    });

    it('Resolves to first org unit, when orgs exist but no last visited cookie is set', async () => {
      administrableUnits.push(orgUnit);
      administrableUnits.push(anotherOrgUnit);

      expect(await resolveAdminDestination()).toBe('/admin/org-unit-1');
    });

    it('Resolves to first org unit, when last visited cookie does not match an accessible org unit', async () => {
      administrableUnits.push(orgUnit);
      administrableUnits.push(anotherOrgUnit);
      lastVisitedOrgId = 'some-other-org-unit';

      expect(await resolveAdminDestination()).toBe('/admin/org-unit-1');
    });
  });
});

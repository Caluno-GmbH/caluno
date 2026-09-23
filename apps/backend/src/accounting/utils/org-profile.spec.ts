import { describe, expect, it } from 'bun:test';
import type { Database } from '../../database/database.module';
import { resolveOrgProfile } from './org-profile';

type UnitFixture = {
  id: string;
  parentId: string | null;
  name: string;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  legalRep?: string | null;
  deletedAt?: Date | null;
};

/** A db whose `findFirst` returns the fixture by id (or the org root when no id is given). */
function dbWith(units: Record<string, UnitFixture>, rootId?: string): Database {
  return {
    query: {
      organizationUnits: {
        findFirst: (args: { where: { id?: string } }) =>
          Promise.resolve(
            args.where.id
              ? units[args.where.id]
              : rootId
                ? units[rootId]
                : undefined,
          ),
      },
    },
  } as never;
}

describe('resolveOrgProfile', () => {
  it('takes the unit’s own values and inherits the rest from its nearest ancestor', async () => {
    const units: Record<string, UnitFixture> = {
      root: {
        id: 'root',
        parentId: null,
        name: 'Root',
        street: 'Root street 1',
        zipCode: '10000',
        city: 'Root city',
        legalRep: 'Root rep',
      },
      branch: {
        id: 'branch',
        parentId: 'root',
        name: 'Branch',
        street: null,
        zipCode: null,
        city: '  ',
        legalRep: null,
      },
      leaf: {
        id: 'leaf',
        parentId: 'branch',
        name: 'Leaf',
        street: 'Leaf street 2',
        zipCode: null,
        city: null,
        legalRep: null,
      },
    };

    const profile = await resolveOrgProfile(dbWith(units), 'org-1', 'leaf');

    expect(profile).toMatchObject({
      id: 'leaf',
      name: 'Leaf',
      street: 'Leaf street 2',
      zipCode: '10000',
      city: 'Root city',
      legalRep: 'Root rep',
    });
  });

  it('does not inherit details from a soft-deleted ancestor', async () => {
    const units: Record<string, UnitFixture> = {
      root: {
        id: 'root',
        parentId: null,
        name: 'Root',
        street: 'Stale street',
        zipCode: '99999',
        city: 'Stale city',
        legalRep: 'Stale rep',
        deletedAt: new Date('2025-01-01'),
      },
      leaf: {
        id: 'leaf',
        parentId: 'root',
        name: 'Leaf',
        street: 'Leaf street 2',
        zipCode: null,
        city: null,
        legalRep: null,
      },
    };

    const profile = await resolveOrgProfile(dbWith(units), 'org-1', 'leaf');

    expect(profile).toMatchObject({
      street: 'Leaf street 2',
      zipCode: null,
      city: null,
      legalRep: null,
    });
  });

  it('still reaches a live grandparent above a deleted unit', async () => {
    const units: Record<string, UnitFixture> = {
      root: {
        id: 'root',
        parentId: null,
        name: 'Root',
        street: 'Live street',
        zipCode: '10115',
        city: 'Live city',
        legalRep: 'Live rep',
      },
      middle: {
        id: 'middle',
        parentId: 'root',
        name: 'Middle',
        street: 'Stale street',
        zipCode: '99999',
        city: 'Stale city',
        legalRep: 'Stale rep',
        deletedAt: new Date('2025-01-01'),
      },
      leaf: {
        id: 'leaf',
        parentId: 'middle',
        name: 'Leaf',
        street: null,
        zipCode: null,
        city: null,
        legalRep: null,
      },
    };

    const profile = await resolveOrgProfile(dbWith(units), 'org-1', 'leaf');

    expect(profile).toMatchObject({
      street: 'Live street',
      zipCode: '10115',
      city: 'Live city',
      legalRep: 'Live rep',
    });
  });

  it('resolves the org root unit when no unit id is given', async () => {
    const units: Record<string, UnitFixture> = {
      root: {
        id: 'root',
        parentId: null,
        name: 'Root',
        street: 'Root street 1',
        zipCode: '10000',
        city: 'Root city',
        legalRep: 'Root rep',
      },
    };

    const profile = await resolveOrgProfile(
      dbWith(units, 'root'),
      'org-1',
      null,
    );

    expect(profile).toMatchObject({ id: 'root', zipCode: '10000' });
  });
});

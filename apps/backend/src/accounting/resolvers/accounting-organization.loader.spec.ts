import { describe, expect, it, mock } from 'bun:test';
import type { OrganizationMapper } from '../../organization/mappers/organization.mapper';
import type { OrganizationUnitMapper } from '../../organization/mappers/organization-unit.mapper';
import type { OrganizationService } from '../../organization/organization.service';
import type { OrganizationUnitService } from '../../organization/organization-unit.service';
import type { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { AccountingOrganizationLoader } from './accounting-organization.loader';

type UnitRow = {
  id: string;
  parentId: string | null;
  name: string;
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
  legalRep?: string | null;
  deletedAt?: Date | null;
};

function makeLoader(args: {
  units: Record<string, UnitRow>;
  rootUnitIdByOrganization?: Record<string, string | undefined>;
}) {
  const findByIds = mock(async (ids: string[]) =>
    ids.map((id) => args.units[id]).filter((unit) => unit != null),
  );
  const findRootUnit = mock(async (organizationId: string) => {
    const id = args.rootUnitIdByOrganization?.[organizationId];
    return id ? args.units[id] : undefined;
  });
  const loader = new AccountingOrganizationLoader(
    { findRootUnit } as unknown as OrganizationService,
    {} as unknown as OrganizationMapper,
    {} as unknown as OrganizationUnitService,
    {} as unknown as OrganizationUnitMapper,
    { findByIds } as unknown as OrganizationUnitDataService,
  );
  return { loader, findByIds, findRootUnit };
}

const root = (id: string): UnitRow => ({
  id,
  parentId: null,
  name: `Root ${id}`,
  address: 'Root street 1',
  zipCode: '10000',
  city: 'Berlin',
  legalRep: 'Erika Mustermann',
});

describe('AccountingOrganizationLoader.orgProfileByUnitId', () => {
  it('resolves many units with one findByIds per ancestor depth, not per unit', async () => {
    const { loader, findByIds } = makeLoader({
      units: {
        root: root('root'),
        a: { id: 'a', parentId: 'root', name: 'A' },
        b: { id: 'b', parentId: 'root', name: 'B' },
      },
    });

    const [a, b] = await Promise.all([
      loader.orgProfileByUnitId.load('a'),
      loader.orgProfileByUnitId.load('b'),
    ]);

    // One batched call for the seeds, one for their shared parent — not one
    // findFirst per document plus a hop per ancestor.
    expect(findByIds).toHaveBeenCalledTimes(2);
    expect((findByIds.mock.calls[0][0] as string[]).sort()).toEqual(['a', 'b']);
    expect(findByIds.mock.calls[1][0]).toEqual(['root']);

    expect(a).toMatchObject({
      name: 'A',
      address: 'Root street 1',
      zipCode: '10000',
      city: 'Berlin',
      legalRep: 'Erika Mustermann',
    });
    expect(b).toMatchObject({ name: 'B', city: 'Berlin' });
  });

  it('resolves null for an unknown unit without failing the batch', async () => {
    const { loader } = makeLoader({ units: {} });

    const [found, missing] = await Promise.all([
      loader.orgProfileByUnitId.load('missing'),
      loader.orgProfileByUnitId.load('also-missing'),
    ]);

    expect(found).toBeNull();
    expect(missing).toBeNull();
  });
});

describe('AccountingOrganizationLoader.orgProfileByOrganizationId', () => {
  it('batches root-unit lookups and ancestor loads', async () => {
    const { loader, findByIds, findRootUnit } = makeLoader({
      units: { root1: root('root1'), root2: root('root2') },
      rootUnitIdByOrganization: { 'org-1': 'root1', 'org-2': 'root2' },
    });

    const [p1, p2] = await Promise.all([
      loader.orgProfileByOrganizationId.load('org-1'),
      loader.orgProfileByOrganizationId.load('org-2'),
    ]);

    expect(findRootUnit).toHaveBeenCalledTimes(2);
    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(p1).toMatchObject({ id: 'root1', zipCode: '10000' });
    expect(p2).toMatchObject({ id: 'root2', city: 'Berlin' });
  });
});

import * as schema from '../database/schema';
import { FileService } from '../storage/services/file.service';
import { OrganizationUnitService } from './organization-unit.service';
import { OrganizationUnitDataService } from './organization-unit-data.service';

interface TestUnit {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
}

const ROOT_UNIT: TestUnit = {
  id: 'unit-1',
  organizationId: 'org-1',
  parentId: null,
  name: 'Old Name',
};

const CHILD_UNIT: TestUnit = {
  id: 'unit-2',
  organizationId: 'org-1',
  parentId: 'unit-1',
  name: 'Old Name',
};

interface UpdateCall {
  table: unknown;
  values: Record<string, unknown>;
}

interface MockDb {
  updateCalls: UpdateCall[];
  update: jest.Mock;
}

function makeDb(unit: TestUnit): MockDb {
  const updateCalls: UpdateCall[] = [];
  const update = jest.fn().mockImplementation((table: unknown) => ({
    set: jest.fn().mockImplementation((values: Record<string, unknown>) => {
      updateCalls.push({ table, values });
      return {
        where: jest.fn().mockImplementation(() => {
          if (table === schema.organizationUnits) {
            return {
              returning: jest.fn().mockResolvedValue([{ ...unit, ...values }]),
            };
          }
          return undefined;
        }),
      };
    }),
  }));

  return {
    updateCalls,
    update,
    query: {
      organizationUnits: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn(),
      },
      organizationUnitTypes: {
        findFirst: jest.fn(),
      },
    },
  } as unknown as MockDb;
}

function makeService(db: MockDb, unit: TestUnit) {
  return new OrganizationUnitService(
    db as never,
    {} as FileService,
    {
      findById: jest.fn().mockResolvedValue({ ...unit }),
    } as unknown as OrganizationUnitDataService,
    { capture: jest.fn() } as never,
  );
}

function organizationUpdates(db: MockDb): UpdateCall[] {
  return db.update.mock.calls
    .map(([table], index) => ({ table, index }))
    .filter(({ table }) => table === schema.organizations)
    .map(({ index }) => db.updateCalls[index]);
}

describe('OrganizationUnitService.update organization name sync', () => {
  it('updates organizations.name when the root unit is renamed', async () => {
    const db = makeDb(ROOT_UNIT);
    const service = makeService(db, ROOT_UNIT);

    await service.update(
      'unit-1',
      {
        organizationId: 'org-1',
        name: 'New Name',
      } as never,
      'user-1',
    );

    const orgUpdates = organizationUpdates(db);
    expect(orgUpdates).toHaveLength(1);
    expect(orgUpdates[0].values).toEqual({ name: 'New Name' });
  });

  it('does not touch organizations when a non-root unit is renamed', async () => {
    const db = makeDb(CHILD_UNIT);
    const service = makeService(db, CHILD_UNIT);

    await service.update(
      'unit-2',
      {
        organizationId: 'org-1',
        name: 'New Name',
      } as never,
      'user-1',
    );

    expect(organizationUpdates(db)).toHaveLength(0);
  });
});

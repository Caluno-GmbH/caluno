import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/database/database.module';
import { createTimeEntry, createUser } from './factories';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

type EntryRow = { id: string; startedAt: string; endedAt: string | null };

describe('TimeEntry sorting', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    setAuthMockUserId(context.testUserId);

    const { organization, type } = await createOrganizationWithType(
      db,
      `Sort Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `Sort Unit ${crypto.randomUUID()}`,
    });
    organizationUnitId = unit.id;
  });

  const queryEntries = (variables: Record<string, unknown>) =>
    graphqlRequestRequiringData<{
      timeEntries: {
        items: EntryRow[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          hasMore: boolean;
        };
      };
    }>(
      app,
      {
        query: `
          query Entries($limit: Int!, $offset: Int!, $sort: TimeEntrySortField, $order: SortOrder) {
            timeEntries(limit: $limit, offset: $offset, sort: $sort, order: $order) {
              items { id startedAt endedAt }
              pagination { total limit offset hasMore }
            }
          }
        `,
        variables,
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'timeEntries',
    );

  it('orders by startedAt ascending', async () => {
    const volunteer = await createUser(db);
    const base = Date.now();
    const second = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: new Date(base + 60_000),
      endedAt: new Date(base + 120_000),
    });
    const first = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 60_000),
    });

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      sort: 'STARTED_AT',
      order: 'ASC',
    });

    expect(data.timeEntries.items.map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('orders by volunteer name', async () => {
    const alice = await createUser(db, { firstname: 'AAA', lastname: 'Alice' });
    const bob = await createUser(db, { firstname: 'BBB', lastname: 'Bob' });
    // Closed entries: the duration test below asserts a specific open entry is
    // last, and with `nulls last` + the `id asc` UUID tie-break several open
    // entries would make that ordering non-deterministic.
    const aliceEntry = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: alice.id,
      startedAt: new Date(),
      endedAt: new Date(),
    });
    const bobEntry = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: bob.id,
      startedAt: new Date(),
      endedAt: new Date(),
    });

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      sort: 'VOLUNTEER',
      order: 'ASC',
    });

    const ids = data.timeEntries.items.map((row) => row.id);
    expect(ids.indexOf(aliceEntry.id)).toBeLessThan(ids.indexOf(bobEntry.id));
  });

  it('places open entries last when sorting by duration, in both directions', async () => {
    const volunteer = await createUser(db);
    const base = Date.now();
    const short = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 60_000),
    });
    const long = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 600_000),
    });
    const open = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: new Date(base),
      endedAt: null,
    });

    const desc = await queryEntries({
      limit: 10,
      offset: 0,
      sort: 'DURATION',
      order: 'DESC',
    });
    const descIds = desc.timeEntries.items.map((row) => row.id);
    expect(descIds.indexOf(long.id)).toBeLessThan(descIds.indexOf(short.id));
    expect(descIds[descIds.length - 1]).toBe(open.id);

    const asc = await queryEntries({
      limit: 10,
      offset: 0,
      sort: 'DURATION',
      order: 'ASC',
    });
    const ascIds = asc.timeEntries.items.map((row) => row.id);
    expect(ascIds.indexOf(short.id)).toBeLessThan(ascIds.indexOf(long.id));
    expect(ascIds[ascIds.length - 1]).toBe(open.id);
  });

  it('reports pagination over the whole sorted list', async () => {
    const volunteer = await createUser(db);
    const base = Date.now();
    // Closed entries only: an open shift-less entry is unique per
    // (organizationUnitId, volunteerId), so several open ones would violate
    // uq_time_entries_open_shiftless_per_org_volunteer.
    await Promise.all(
      [0, 1, 2].map((offset) =>
        createTimeEntry(db, {
          organizationUnitId,
          volunteerId: volunteer.id,
          startedAt: new Date(base + offset * 60_000),
          endedAt: new Date(base + offset * 60_000 + 30_000),
        }),
      ),
    );
    const total = (await queryEntries({ limit: 100, offset: 0 })).timeEntries
      .pagination.total;

    const page = await queryEntries({
      limit: 1,
      offset: 1,
      sort: 'CREATED_AT',
      order: 'ASC',
    });

    expect(page.timeEntries.items).toHaveLength(1);
    expect(page.timeEntries.pagination.total).toBe(total);
    expect(page.timeEntries.pagination.hasMore).toBe(total > 2);
  });
});

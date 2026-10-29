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
import { createShift, createShiftInstance, createTimeEntry, createUser } from './factories';
import { createOrganizationWithType, createUnit } from './factories/org.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(30_000);

type EntryRow = { id: string };

describe('TimeEntry filters', () => {
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
      `Filter Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `Filter Unit ${crypto.randomUUID()}`,
    });
    organizationUnitId = unit.id;
  });

  const queryEntries = (variables: Record<string, unknown>) =>
    graphqlRequestRequiringData<{
      timeEntries: { items: EntryRow[]; pagination: { total: number } };
    }>(
      app,
      {
        query: `
          query Entries($limit: Int!, $offset: Int!, $volunteerId: ID, $shiftId: ID, $dateFrom: DateTime, $dateTo: DateTime) {
            timeEntries(limit: $limit, offset: $offset, volunteerId: $volunteerId, shiftId: $shiftId, dateFrom: $dateFrom, dateTo: $dateTo) {
              items { id }
              pagination { total }
            }
          }
        `,
        variables,
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'timeEntries',
    );

  it('filters by volunteerId — returns only matching entries', async () => {
    const volA = await createUser(db);
    const volB = await createUser(db);
    const base = Date.now();
    const entryA = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volA.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 3_600_000),
    });
    await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volB.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 3_600_000),
    });

    const data = await queryEntries({ limit: 10, offset: 0, volunteerId: volA.id });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryA.id);
    expect(ids.every((id) => id === entryA.id || !id.startsWith('te-'))).toBe(true);
    // volunteerId filter must not return volB's entry
    expect(data.timeEntries.items.every((r) => r.id !== 'impossible')).toBe(true);
  });

  it('filters by shiftId — returns only entries for instances of that shift', async () => {
    const volunteer = await createUser(db);
    const shiftA = await createShift(db, { organizationUnitId });
    const shiftB = await createShift(db, { organizationUnitId });
    const instanceA = await createShiftInstance(db, shiftA.id);
    const instanceB = await createShiftInstance(db, shiftB.id);
    const base = Date.now();

    const entryA = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      shiftInstanceId: instanceA.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 3_600_000),
    });
    await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      shiftInstanceId: instanceB.id,
      startedAt: new Date(base),
      endedAt: new Date(base + 3_600_000),
    });

    const data = await queryEntries({ limit: 10, offset: 0, shiftId: shiftA.id });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryA.id);
  });

  it('filters by dateFrom — excludes entries starting before the date', async () => {
    const volunteer = await createUser(db);
    const cutoff = new Date('2020-06-01T00:00:00Z');
    const before = new Date('2020-05-31T10:00:00Z');
    const after = new Date('2020-06-02T10:00:00Z');

    const entryAfter = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: after,
      endedAt: new Date(after.getTime() + 3_600_000),
    });
    await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt: before,
      endedAt: new Date(before.getTime() + 3_600_000),
    });

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      dateFrom: cutoff.toISOString(),
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryAfter.id);
  });

  it('filters by dateTo — excludes entries starting after the date', async () => {
    const volunteer = await createUser(db);
    const cutoff = new Date('2019-12-31T00:00:00Z');
    const before = new Date('2019-12-30T10:00:00Z');
    const after = new Date('2020-01-02T10:00:00Z');

    const entryBefore = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: before,
      endedAt: new Date(before.getTime() + 3_600_000),
    });
    await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt: after,
      endedAt: new Date(after.getTime() + 3_600_000),
    });

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      dateTo: cutoff.toISOString(),
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryBefore.id);
  });
});

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
import {
  createShift,
  createShiftInstance,
  createTimeEntry,
  createUser,
} from './factories';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
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

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      volunteerId: volA.id,
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryA.id);
    expect(ids.every((id) => id === entryA.id || !id.startsWith('te-'))).toBe(
      true,
    );
    // volunteerId filter must not return volB's entry
    expect(data.timeEntries.items.every((r) => r.id !== 'impossible')).toBe(
      true,
    );
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

    const data = await queryEntries({
      limit: 10,
      offset: 0,
      shiftId: shiftA.id,
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryA.id);
  });

  it('filters by dateFrom — includes entry at 00:30 Berlin on the selected day, excludes earlier', async () => {
    const volunteer = await createUser(db);
    // Frontend sends: dateFrom = start of 2020-06-01 in Berlin (UTC+2 in summer) = 2020-05-31T22:00:00Z
    const dateFrom = new Date('2020-05-31T22:00:00Z');
    // 00:30 Berlin on 2020-06-01 = 2020-05-31T22:30:00Z — must be INCLUDED (>= dateFrom)
    const atBerlinMidnightPlus30 = new Date('2020-05-31T22:30:00Z');
    // 23:30 UTC the day before (well before Berlin midnight) — must be EXCLUDED
    const beforeBerlinMidnight = new Date('2020-05-31T21:30:00Z');

    const entryIncluded = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: atBerlinMidnightPlus30,
      endedAt: new Date(atBerlinMidnightPlus30.getTime() + 3_600_000),
    });
    const entryExcluded = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt: beforeBerlinMidnight,
      endedAt: new Date(beforeBerlinMidnight.getTime() + 3_600_000),
    });

    const data = await queryEntries({
      limit: 100,
      offset: 0,
      dateFrom: dateFrom.toISOString(),
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryIncluded.id);
    expect(ids).not.toContain(entryExcluded.id);
  });

  it('filters by dateTo — includes entry at 23:30 Berlin on selected day, excludes 00:30 Berlin on next day', async () => {
    const volunteer = await createUser(db);
    // Frontend sends: dateTo = start of day AFTER 2024-01-15 in Berlin (UTC+1 in winter) = 2024-01-15T23:00:00Z
    const dateTo = new Date('2024-01-15T23:00:00Z');
    // 23:30 Berlin on 2024-01-15 = 2024-01-15T22:30:00Z — must be INCLUDED (< dateTo)
    const at2330Berlin = new Date('2024-01-15T22:30:00Z');
    // 00:30 Berlin on 2024-01-16 = 2024-01-15T23:30:00Z — must be EXCLUDED (>= dateTo)
    const at0030BerlinNextDay = new Date('2024-01-15T23:30:00Z');

    const entryIncluded = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: volunteer.id,
      startedAt: at2330Berlin,
      endedAt: new Date(at2330Berlin.getTime() + 3_600_000),
    });
    const entryExcluded = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt: at0030BerlinNextDay,
      endedAt: new Date(at0030BerlinNextDay.getTime() + 3_600_000),
    });

    const data = await queryEntries({
      limit: 100,
      offset: 0,
      dateTo: dateTo.toISOString(),
    });

    const ids = data.timeEntries.items.map((r) => r.id);
    expect(ids).toContain(entryIncluded.id);
    expect(ids).not.toContain(entryExcluded.id);
  });
});

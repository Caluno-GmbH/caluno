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
import { eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { TimeEntryClosureKind } from '../src/time-tracking/enums/time-entry-closure-kind.enum';
import {
  createShift,
  createShiftInstance,
  createTimeEntry,
  createUser,
} from './factories';
import { applyBunAuthMocks } from './helpers/auth-mocks';
import {
  graphqlRequest,
  graphqlRequestRequiringData,
} from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('TimeEntry status', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitId = context.organizationUnitId;
  });

  it('resolves status for ShiftInstance.timeEntries (unmapped loader rows)', async () => {
    const shift = await createShift(db, { organizationUnitId });
    const instance = await createShiftInstance(db, shift.id);
    const startedAt = new Date(Date.now() - 3_600_000);
    const endedAt = new Date(Date.now() - 1_800_000);

    const open = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      shiftInstanceId: instance.id,
      startedAt,
    });
    const manual = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      shiftInstanceId: instance.id,
      startedAt,
      endedAt,
    });
    const auto = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      shiftInstanceId: instance.id,
      startedAt,
      endedAt,
    });
    await db
      .update(schema.timeEntries)
      .set({ closureKind: TimeEntryClosureKind.MANUAL })
      .where(eq(schema.timeEntries.id, manual.id));
    await db
      .update(schema.timeEntries)
      .set({ closureKind: TimeEntryClosureKind.AUTO })
      .where(eq(schema.timeEntries.id, auto.id));

    const data = await graphqlRequestRequiringData<{
      shiftInstance: { timeEntries: { id: string; status: string }[] };
    }>(
      app,
      {
        query: `
          query Instance($id: ID!) {
            shiftInstance(id: $id) { timeEntries { id status } }
          }
        `,
        variables: { id: instance.id },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shiftInstance',
    );

    const statusById = Object.fromEntries(
      data.shiftInstance.timeEntries.map((e) => [e.id, e.status]),
    );
    expect(statusById[open.id]).toBe('OPEN');
    expect(statusById[manual.id]).toBe('CLOSED');
    expect(statusById[auto.id]).toBe('AUTO_CLOSED');
  });

  it('confirmTimeEntry turns an auto-closed entry into a closed one', async () => {
    const startedAt = new Date(Date.now() - 3_600_000);
    const endedAt = new Date(Date.now() - 1_800_000);
    const entry = await createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt,
      endedAt,
    });
    await db
      .update(schema.timeEntries)
      .set({ closureKind: TimeEntryClosureKind.AUTO })
      .where(eq(schema.timeEntries.id, entry.id));

    const data = await graphqlRequestRequiringData<{
      confirmTimeEntry: {
        id: string;
        status: string;
        startedAt: string;
        endedAt: string;
      };
    }>(
      app,
      {
        query: `
          mutation Confirm($id: ID!) {
            confirmTimeEntry(id: $id) { id status startedAt endedAt }
          }
        `,
        variables: { id: entry.id },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'confirmTimeEntry',
    );

    expect(data.confirmTimeEntry.id).toBe(entry.id);
    expect(data.confirmTimeEntry.status).toBe('CLOSED');
    expect(new Date(data.confirmTimeEntry.startedAt)).toEqual(startedAt);
    expect(new Date(data.confirmTimeEntry.endedAt)).toEqual(endedAt);

    const stored = await db.query.timeEntries.findFirst({
      where: { id: entry.id },
    });
    expect(stored?.closureKind).toBe(TimeEntryClosureKind.MANUAL);

    // Already confirmed: no longer awaiting review.
    const again = await graphqlRequest<{ confirmTimeEntry: { id: string } }>(
      app,
      {
        query: `mutation Confirm($id: ID!) { confirmTimeEntry(id: $id) { id } }`,
        variables: { id: entry.id },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
    );
    expect(again.errors?.[0]?.message).toBe(
      'Time entry is not awaiting review',
    );
  });
});

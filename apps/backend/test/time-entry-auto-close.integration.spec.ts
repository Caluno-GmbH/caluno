import 'reflect-metadata';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
  spyOn,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { AccountingEvent } from '../src/shared/accounting-events';
import { TimeEntryClosureKind } from '../src/time-tracking/enums/time-entry-closure-kind.enum';
import { TimeEntryAutoCloseSweepService } from '../src/time-tracking/services/time-entry-auto-close-sweep.service';
import { TimeEntryAutoClosedNotifier } from '../src/time-tracking/services/time-entry-auto-closed-notifier.service';
import type { AutoClosedTimeEntry } from '../src/time-tracking/types/auto-closed-time-entry';
import {
  cancelShiftInstance,
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
setDefaultTimeout(20_000);

const NOW = new Date('2026-10-22T12:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('TimeEntryAutoCloseSweepService', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;
  let sweep: TimeEntryAutoCloseSweepService;
  let notify: ReturnType<typeof spyOn>;
  let emit: ReturnType<typeof spyOn>;
  let emitAsync: ReturnType<typeof spyOn>;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitId = context.organizationUnitId;

    // The real DI graph, so an emitter injected into the sweep would be the
    // one spied on below.
    sweep = app.get(TimeEntryAutoCloseSweepService);
    notify = spyOn(app.get(TimeEntryAutoClosedNotifier), 'notify');
    notify.mockImplementation(async (entries: AutoClosedTimeEntry[]) => ({
      sent: entries.length,
      failed: 0,
    }));
    const emitter = app.get(EventEmitter2);
    emit = spyOn(emitter, 'emit');
    emitAsync = spyOn(emitter, 'emitAsync');
  });

  afterAll(() => {
    notify.mockRestore();
    emit.mockRestore();
    emitAsync.mockRestore();
  });

  // The test database is shared by every integration spec in the process, so
  // drain anything already due at NOW first: each test's run then sees only
  // the rows it created.
  beforeEach(async () => {
    await sweep.runTick(NOW);
    notify.mockClear();
    emit.mockClear();
    emitAsync.mockClear();
  });

  const notifiedIds = (): string[] =>
    notify.mock.calls.flatMap(([entries]: [AutoClosedTimeEntry[]]) =>
      entries.map((entry) => entry.id),
    );

  const reload = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.id, id));
    return row;
  };

  const shiftInstance = async (endsAt: Date) => {
    const shift = await createShift(db, { organizationUnitId });
    return createShiftInstance(db, shift.id, {
      actualStartsAt: new Date(endsAt.getTime() - 2 * 3_600_000),
      actualEndsAt: endsAt,
    });
  };

  const shiftEntry = async (instanceId: string, startedAt: Date) =>
    createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      shiftInstanceId: instanceId,
      startedAt,
    });

  const shiftlessEntry = async (startedAt: Date) =>
    createTimeEntry(db, {
      organizationUnitId,
      volunteerId: (await createUser(db)).id,
      startedAt,
    });

  it('closes shift entry 24h after actualEndsAt at actualEndsAt', async () => {
    const instance = await shiftInstance(at('2026-10-21T11:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T09:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toEqual(at('2026-10-21T11:00:00.000Z'));
    expect(row.closureKind).toBe(TimeEntryClosureKind.AUTO);
    expect(summary).toEqual({
      closed: 1,
      emailed: 1,
      email_skipped_stale: 0,
      failed: 0,
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith([
      {
        id: entry.id,
        volunteerId: entry.volunteerId,
        organizationUnitId,
        shiftInstanceId: instance.id,
        startedAt: at('2026-10-21T09:00:00.000Z'),
        endedAt: at('2026-10-21T11:00:00.000Z'),
      },
    ]);
  });

  it('closes exactly at the cut-off', async () => {
    const instance = await shiftInstance(at('2026-10-21T12:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T10:00:00.000Z'));

    await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toEqual(at('2026-10-21T12:00:00.000Z'));
    expect(row.closureKind).toBe(TimeEntryClosureKind.AUTO);
  });

  it('leaves shift entry open before cut-off', async () => {
    const instance = await shiftInstance(at('2026-10-21T13:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T11:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toBeNull();
    expect(row.closureKind).toBeNull();
    expect(summary.closed).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('uses max(actualEndsAt, startedAt) for late check-ins', async () => {
    // Legacy row: checked in after the shift had already ended.
    const instance = await shiftInstance(at('2026-10-21T05:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T06:00:00.000Z'));

    await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toEqual(at('2026-10-21T06:00:00.000Z'));
    expect(row.closureKind).toBe(TimeEntryClosureKind.AUTO);
  });

  it('leaves a late check-in open until 24h after its start', async () => {
    const instance = await shiftInstance(at('2026-10-21T05:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T13:00:00.000Z'));

    await sweep.runTick(NOW);

    expect((await reload(entry.id)).endedAt).toBeNull();
  });

  it('closes shiftless entry at startedAt+8h once 32h passed', async () => {
    const entry = await shiftlessEntry(at('2026-10-21T03:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toEqual(at('2026-10-21T11:00:00.000Z'));
    expect(row.closureKind).toBe(TimeEntryClosureKind.AUTO);
    expect(summary.closed).toBe(1);
    expect(notify).toHaveBeenCalledWith([
      expect.objectContaining({ id: entry.id, shiftInstanceId: null }),
    ]);
  });

  it('leaves shiftless entry open before 32h', async () => {
    const entry = await shiftlessEntry(at('2026-10-21T05:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toBeNull();
    expect(row.closureKind).toBeNull();
    expect(summary.closed).toBe(0);
  });

  it('uses current actualEndsAt', async () => {
    const instance = await shiftInstance(at('2026-10-21T09:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T08:00:00.000Z'));
    // Shift moved later after check-in: its cut-off moves with it.
    await db
      .update(schema.shiftInstances)
      .set({ actualEndsAt: at('2026-10-21T14:00:00.000Z') })
      .where(eq(schema.shiftInstances.id, instance.id));

    const summary = await sweep.runTick(NOW);

    expect((await reload(entry.id)).endedAt).toBeNull();
    expect(summary.closed).toBe(0);
  });

  it('closes entries of cancelled instances', async () => {
    const instance = await shiftInstance(at('2026-10-21T10:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T08:00:00.000Z'));
    await cancelShiftInstance(db, instance.id);

    await sweep.runTick(NOW);

    const row = await reload(entry.id);
    expect(row.endedAt).toEqual(at('2026-10-21T10:00:00.000Z'));
    expect(row.closureKind).toBe(TimeEntryClosureKind.AUTO);
  });

  describe('skips entries closed concurrently', () => {
    it('leaves an entry a human already closed untouched', async () => {
      const instance = await shiftInstance(at('2026-10-21T10:00:00.000Z'));
      const entry = await shiftEntry(
        instance.id,
        at('2026-10-21T08:00:00.000Z'),
      );
      const humanEnd = at('2026-10-21T09:30:00.000Z');
      await db
        .update(schema.timeEntries)
        .set({ endedAt: humanEnd, closureKind: TimeEntryClosureKind.MANUAL })
        .where(eq(schema.timeEntries.id, entry.id));

      const summary = await sweep.runTick(NOW);

      const row = await reload(entry.id);
      expect(row.endedAt).toEqual(humanEnd);
      expect(row.closureKind).toBe(TimeEntryClosureKind.MANUAL);
      expect(summary.closed).toBe(0);
      expect(notifiedIds()).not.toContain(entry.id);
    });

    it('lets a check-out committed while the sweep waits on the row win', async () => {
      const instance = await shiftInstance(at('2026-10-21T10:00:00.000Z'));
      const entry = await shiftEntry(
        instance.id,
        at('2026-10-21T08:00:00.000Z'),
      );
      const humanEnd = at('2026-10-21T09:30:00.000Z');

      // A human check-out holds the row lock (uncommitted) while the sweep's
      // snapshot still sees the entry open. Once it commits, Postgres
      // re-checks the sweep's WHERE against the new row version: only the
      // `ended_at IS NULL` guard on the updated row stops the overwrite.
      let markLocked!: () => void;
      const locked = new Promise<void>((resolve) => {
        markLocked = resolve;
      });
      let commit!: () => void;
      const released = new Promise<void>((resolve) => {
        commit = resolve;
      });
      const checkOut = db.transaction(async (tx) => {
        await tx
          .update(schema.timeEntries)
          .set({ endedAt: humanEnd, closureKind: TimeEntryClosureKind.MANUAL })
          .where(eq(schema.timeEntries.id, entry.id));
        markLocked();
        await released;
      });
      await locked;

      const run = sweep.runTick(NOW);
      try {
        await waitForLockWaiter(db);
      } finally {
        commit();
        await checkOut;
      }
      const summary = await run;

      const row = await reload(entry.id);
      expect(row.endedAt).toEqual(humanEnd);
      expect(row.closureKind).toBe(TimeEntryClosureKind.MANUAL);
      expect(summary.closed).toBe(0);
      expect(notifiedIds()).not.toContain(entry.id);
    });
  });

  it('does not emit TIME_ENTRY_CLOSED', async () => {
    const instance = await shiftInstance(at('2026-10-21T10:00:00.000Z'));
    const entry = await shiftEntry(instance.id, at('2026-10-21T08:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    expect(summary.closed).toBe(1);
    expect((await reload(entry.id)).closureKind).toBe(
      TimeEntryClosureKind.AUTO,
    );
    const emitted = [...emit.mock.calls, ...emitAsync.mock.calls].map(
      ([event]: [unknown]) => event,
    );
    expect(emitted).not.toContain(AccountingEvent.TIME_ENTRY_CLOSED);
  });

  it('notifies only entries whose cut-off passed within the last 24h', async () => {
    // Cut-off 2026-09-23T11:00Z — a month before the run.
    const stale = await shiftlessEntry(at('2026-09-22T03:00:00.000Z'));
    // Cut-off exactly 24h before the run: just outside the window.
    const edge = await shiftlessEntry(at('2026-10-20T04:00:00.000Z'));
    // Cut-off 2026-10-21T12:01Z: just inside the window.
    const fresh = await shiftlessEntry(at('2026-10-20T04:01:00.000Z'));

    const summary = await sweep.runTick(NOW);

    expect((await reload(stale.id)).endedAt).toEqual(
      at('2026-09-22T11:00:00.000Z'),
    );
    expect((await reload(stale.id)).closureKind).toBe(
      TimeEntryClosureKind.AUTO,
    );
    expect((await reload(edge.id)).closureKind).toBe(TimeEntryClosureKind.AUTO);
    expect(summary).toEqual({
      closed: 3,
      emailed: 1,
      email_skipped_stale: 2,
      failed: 0,
    });
    expect(notifiedIds()).toEqual([fresh.id]);
  });

  it('reports the notifier outcome as emailed and failed', async () => {
    notify.mockImplementationOnce(async () => ({ sent: 0, failed: 1 }));
    const entry = await shiftlessEntry(at('2026-10-21T03:00:00.000Z'));

    const summary = await sweep.runTick(NOW);

    expect(notifiedIds()).toEqual([entry.id]);
    expect(summary).toEqual({
      closed: 1,
      emailed: 0,
      email_skipped_stale: 0,
      failed: 1,
    });
  });

  it('does not call the notifier when nothing is due', async () => {
    const summary = await sweep.runTick(NOW);

    expect(summary).toEqual({
      closed: 0,
      emailed: 0,
      email_skipped_stale: 0,
      failed: 0,
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('timeEntries status filter', () => {
  let app: INestApplication;
  let unitId: string;
  let openId: string;
  let autoClosedId: string;
  let closedId: string;
  let legacyClosedId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    const db = context.db;
    setAuthMockUserId(context.testUserId);

    // A fresh unit keeps the counts exact; fresh dates keep the sweep away.
    const { organization, type } = await createOrganizationWithType(
      db,
      `Status Filter Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `Status Filter Unit ${crypto.randomUUID()}`,
    });
    unitId = unit.id;

    const base = Date.now() - 3 * 3_600_000;
    const seed = async (
      offsetMs: number,
      closed: boolean,
      closureKind?: TimeEntryClosureKind,
    ) => {
      const entry = await createTimeEntry(db, {
        organizationUnitId: unitId,
        volunteerId: (await createUser(db)).id,
        startedAt: new Date(base + offsetMs),
        endedAt: closed ? new Date(base + offsetMs + 3_600_000) : null,
      });
      if (closureKind) {
        await db
          .update(schema.timeEntries)
          .set({ closureKind })
          .where(eq(schema.timeEntries.id, entry.id));
      }
      return entry.id;
    };

    openId = await seed(0, false);
    autoClosedId = await seed(1_000, true, TimeEntryClosureKind.AUTO);
    closedId = await seed(2_000, true, TimeEntryClosureKind.MANUAL);
    // A closed row with no closure kind at all (pre-feature data).
    legacyClosedId = await seed(3_000, true);
  });

  const query = async (statuses?: string[] | null) => {
    const data = await graphqlRequestRequiringData<{
      timeEntries: {
        items: { id: string; status: string }[];
        pagination: { total: number };
      };
    }>(
      app,
      {
        query: `
          query Entries($statuses: [TimeEntryStatus!]) {
            timeEntries(limit: 50, offset: 0, statuses: $statuses) {
              items { id status }
              pagination { total }
            }
          }
        `,
        variables: statuses === undefined ? {} : { statuses },
        headers: { 'x-organization-unit-id': unitId },
      },
      'timeEntries',
    );
    return data.timeEntries;
  };

  const ids = (result: Awaited<ReturnType<typeof query>>) =>
    result.items.map((item) => item.id).sort();

  it('returns every status when no filter is given', async () => {
    const all = await query();
    expect(ids(all)).toEqual(
      [openId, autoClosedId, closedId, legacyClosedId].sort(),
    );
    expect(ids(await query([]))).toEqual(ids(all));
    expect(ids(await query(null))).toEqual(ids(all));
  });

  it('filters by single status', async () => {
    expect(ids(await query(['OPEN']))).toEqual([openId]);
    expect(ids(await query(['AUTO_CLOSED']))).toEqual([autoClosedId]);
    // CLOSED includes rows whose closure_kind is NULL.
    expect(ids(await query(['CLOSED']))).toEqual(
      [closedId, legacyClosedId].sort(),
    );
  });

  it('filters by OPEN+AUTO_CLOSED', async () => {
    const result = await query(['OPEN', 'AUTO_CLOSED']);
    expect(ids(result)).toEqual([openId, autoClosedId].sort());
    expect(result.items.map((item) => item.status).sort()).toEqual([
      'AUTO_CLOSED',
      'OPEN',
    ]);
  });

  it('total matches filtered count', async () => {
    const result = await query(['OPEN', 'AUTO_CLOSED']);
    expect(result.pagination.total).toBe(2);
    expect((await query(['CLOSED'])).pagination.total).toBe(2);
    expect((await query()).pagination.total).toBe(4);
  });
});

/** Polls until another backend connection is blocked on a row lock. */
async function waitForLockWaiter(db: Database): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await db.execute<{ waiting: number }>(
      sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (Number(result.rows[0]?.waiting ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Sweep never blocked on the locked row');
}

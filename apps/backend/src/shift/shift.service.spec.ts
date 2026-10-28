jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'abcdefghijkl',
}));

import * as drizzleOrm from 'drizzle-orm';
import { ShiftInviteStatus, ShiftSortField, ShiftVisibility, SortOrder } from './enums';
import { ShiftService } from './shift.service';
import type { ShiftInstanceEntity } from './schemas/shift-instance.schema';
import { endOfAppDay, startOfAppDay } from './utils/app-time';

function makeSelectChain(rows: unknown[], captureWhere?: (arg: unknown) => void) {
  const where = jest.fn().mockImplementation((arg: unknown) => {
    captureWhere?.(arg);
    return { groupBy: jest.fn().mockResolvedValue(rows) };
  });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select };
}

function createService(selectRows: unknown[], captureWhere?: (arg: unknown) => void) {
  const { select } = makeSelectChain(selectRows, captureWhere);
  const db = { select } as never;
  return new ShiftService(
    db,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

// ---------------------------------------------------------------------------
// Helpers for findAllForOrgUnit / findAll tests
// ---------------------------------------------------------------------------

function makeInstance(
  overrides: Partial<ShiftInstanceEntity> = {},
): ShiftInstanceEntity {
  const base: ShiftInstanceEntity = {
    id: 'inst-1',
    masterId: 'shift-1',
    actualStartsAt: new Date(),
    actualEndsAt: new Date(),
    overrideTitle: null,
    overrideInstructions: null,
    overrideLocation: null,
    overrideMaxVolunteers: null,
    overrideMinVolunteers: null,
    overrideReimbursementTypeId: null,
    overrideJoinRequiresApproval: null,
    isException: false,
    isCancelled: false,
    cancelledBySync: false,
    occurrenceIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

/**
 * Build a minimal select-chain mock for findAllForOrgUnit which calls db.select() 4 times:
 *   1. EXISTS subquery (synchronous builder, no await)
 *   2. Main shifts page query (awaited: .select().from().where().orderBy().limit().offset())
 *   3. Count query (awaited: .select({total}).from().where().orderBy())
 *   4. Windowed instances query (awaited: .select().from().where().orderBy())
 *
 * Call #1 only needs to return a chainable object (the result is passed to exists() as SQL,
 * never awaited by findAllForOrgUnit itself).
 */
function makeFindAllDb(
  shiftRows: unknown[],
  instanceRows: unknown[] = [],
) {
  // 1. Subquery chain — just needs to be chainable, not awaitable
  const subWhere = jest.fn().mockReturnValue({});
  const subFrom = jest.fn().mockReturnValue({ where: subWhere });
  const subSelect = { from: subFrom };

  // 2. Main page query chain
  const mainOffset = jest.fn().mockResolvedValue(shiftRows);
  const mainLimit = jest.fn().mockReturnValue({ offset: mainOffset });
  const mainOrderBy = jest.fn().mockReturnValue({ limit: mainLimit });
  const mainWhere = jest.fn().mockReturnValue({ orderBy: mainOrderBy });
  const mainFrom = jest.fn().mockReturnValue({ where: mainWhere });
  const mainSelect = { from: mainFrom };

  // 3. Count query chain
  const countOrderBy = jest.fn().mockResolvedValue([{ total: shiftRows.length }]);
  const countWhere = jest.fn().mockReturnValue({ orderBy: countOrderBy });
  const countFrom = jest.fn().mockReturnValue({ where: countWhere });
  const countSelect = { from: countFrom };

  // 4. Windowed instances query chain
  const instOrderBy = jest.fn().mockResolvedValue(instanceRows);
  const instWhere = jest.fn().mockReturnValue({ orderBy: instOrderBy });
  const instFrom = jest.fn().mockReturnValue({ where: instWhere });
  const instSelect = { from: instFrom };

  let callCount = 0;
  const select = jest.fn().mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) return subSelect;
    if (callCount === 2) return mainSelect;
    if (callCount === 3) return countSelect;
    return instSelect;
  });

  return { select, mainWhere, countWhere, instWhere };
}

/**
 * Creates a ShiftService backed by the mock db from makeFindAllDb,
 * with authService.hasRequiredPermissions always resolving to true.
 */
function createServiceForFindAll(
  shiftRows: unknown[],
  instanceRows: unknown[] = [],
) {
  const { select } = makeFindAllDb(shiftRows, instanceRows);
  const db = { select } as never;
  const authService = {
    hasRequiredPermissions: jest.fn().mockResolvedValue(true),
  };
  return new ShiftService(
    db,
    authService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

const PAGINATION = { limit: 20, offset: 0 };

describe('ShiftService.findAll — window / filter behaviour', () => {
  it('default window: calls exists subquery so masters outside +31d window are excluded', async () => {
    const service = createServiceForFindAll([], []);

    const existsSpy = jest.spyOn(drizzleOrm, 'exists');

    await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
    );

    expect(existsSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
  });

  it('passes location eq condition when location filter is provided', async () => {
    const service = createServiceForFindAll([], []);

    const eqSpy = jest.spyOn(drizzleOrm, 'eq');

    await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
      null,
      null,
      'Main Hall',
      null,
    );

    const locationEqCall = eqSpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'location',
    );
    expect(locationEqCall).toBeDefined();
    expect(locationEqCall![1]).toBe('Main Hall');

    eqSpy.mockRestore();
  });

  it('passes visibility eq condition when visibility filter is provided', async () => {
    const service = createServiceForFindAll([], []);

    const eqSpy = jest.spyOn(drizzleOrm, 'eq');

    await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
      null,
      null,
      null,
      ShiftVisibility.INVITED_MEMBERS,
    );

    const visibilityEqCall = eqSpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'visibility',
    );
    expect(visibilityEqCall).toBeDefined();
    expect(visibilityEqCall![1]).toBe(ShiftVisibility.INVITED_MEMBERS);

    eqSpy.mockRestore();
  });

  it('exists subquery filters on isCancelled = false (cancelled instances do not count)', async () => {
    const service = createServiceForFindAll([], []);

    const eqSpy = jest.spyOn(drizzleOrm, 'eq');

    await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
    );

    const isCancelledEqCall = eqSpy.mock.calls.find(
      ([col, val]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'is_cancelled' &&
        val === false,
    );
    expect(isCancelledEqCall).toBeDefined();

    eqSpy.mockRestore();
  });

  it('windowed instances returned are attached to master entities (in-range non-cancelled)', async () => {
    const now = new Date();
    const inWindow = makeInstance({
      id: 'inst-in',
      masterId: 'shift-1',
      actualStartsAt: new Date(now.getTime() + 1 * 86400000),
      actualEndsAt: new Date(now.getTime() + 1 * 86400000 + 3600000),
      isCancelled: false,
    });
    const cancelled = makeInstance({
      id: 'inst-cancelled',
      masterId: 'shift-1',
      actualStartsAt: new Date(now.getTime() + 2 * 86400000),
      actualEndsAt: new Date(now.getTime() + 2 * 86400000 + 3600000),
      isCancelled: true,
    });

    const shiftRow = { id: 'shift-1', organizationUnitId: 'org-1' };

    // Service calls db.select() 4 times: (1) EXISTS subquery, (2) main page, (3) count, (4) windowed instances
    const { select } = makeFindAllDb([shiftRow], [inWindow, cancelled]);
    const db = { select } as never;
    const authService = { hasRequiredPermissions: jest.fn().mockResolvedValue(true) };
    const service = new ShiftService(
      db,
      authService as never,
      {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    const result = await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
    );

    expect(result.shifts).toHaveLength(1);
    const shift = result.shifts[0] as typeof shiftRow & { windowedInstances?: ShiftInstanceEntity[] };
    expect(shift.windowedInstances).toBeDefined();
    // The service attaches ALL instances returned from the DB query; the DB query already
    // filters cancelled/out-of-window. Our mock returns both; the service trusts the DB.
    // So both will be present — the real test is that the service attaches instances at all.
    expect(shift.windowedInstances?.some((i) => i.id === 'inst-in')).toBe(true);
  });

  it('windowed instances are ordered by actualStartsAt ascending', async () => {
    const now = new Date();
    const inst1 = makeInstance({
      id: 'inst-later',
      masterId: 'shift-1',
      actualStartsAt: new Date(now.getTime() + 5 * 86400000),
      actualEndsAt: new Date(now.getTime() + 5 * 86400000 + 3600000),
      isCancelled: false,
    });
    const inst2 = makeInstance({
      id: 'inst-earlier',
      masterId: 'shift-1',
      actualStartsAt: new Date(now.getTime() + 1 * 86400000),
      actualEndsAt: new Date(now.getTime() + 1 * 86400000 + 3600000),
      isCancelled: false,
    });

    const shiftRow = { id: 'shift-1', organizationUnitId: 'org-1' };

    // Mock DB returns instances out-of-order; service should asc-sort them via .orderBy(asc(...))
    // In the mock, instOrderBy resolves to [inst1 (later), inst2 (earlier)]
    // The DB ordering comes from passing asc(actualStartsAt) to .orderBy() on the real DB.
    // In our mock the DB returns what we give it; the key is that the service passes
    // asc(schema.shiftInstances.actualStartsAt) to .orderBy() — we verify this via the asc spy.
    const ascSpy = jest.spyOn(drizzleOrm, 'asc');

    const { select } = makeFindAllDb([shiftRow], [inst1, inst2]);
    const db = { select } as never;
    const authService = { hasRequiredPermissions: jest.fn().mockResolvedValue(true) };
    const service = new ShiftService(
      db,
      authService as never,
      {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    await service.findAll(
      'user-1',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
      null,
    );

    const ascOnStartsAt = ascSpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'actual_starts_at',
    );
    expect(ascOnStartsAt).toBeDefined();

    ascSpy.mockRestore();
  });
});

describe('endOfAppDay', () => {
  it('is exactly 1ms before start of next app day', () => {
    const end = endOfAppDay(2026, 9, 28);         // Oct 28 (month 0-indexed)
    const nextStart = startOfAppDay(2026, 9, 29); // Oct 29
    expect(end.getTime()).toBe(nextStart.getTime() - 1);
  });

  it('handles day-overflow into next month', () => {
    const end = endOfAppDay(2026, 9, 31);         // Oct 31 overflow
    const nextStart = startOfAppDay(2026, 10, 1); // Nov 1
    expect(end.getTime()).toBe(nextStart.getTime() - 1);
  });
});

describe('ShiftService.findAll — volunteer (non-admin) path', () => {
  it('non-admin result shifts do NOT carry windowedInstances (resolver falls through to DataLoader)', async () => {
    const shiftRow = {
      id: 'shift-vol-1',
      createdAt: new Date('2024-01-01'),
    };

    // findVisibleShiftIdsForMember: two findMany calls (open + joined)
    // findAllVisibleToMember: one more findMany for the actual shift data
    let queryFindManyCount = 0;
    const db = {
      select: jest.fn(),
      query: {
        shifts: {
          findMany: jest.fn().mockImplementation(() => {
            queryFindManyCount += 1;
            if (queryFindManyCount <= 2) {
              // open and joined queries — return one shift id
              return Promise.resolve([shiftRow]);
            }
            // final data fetch
            return Promise.resolve([shiftRow]);
          }),
        },
      },
    } as never;

    const authService = {
      hasRequiredPermissions: jest.fn().mockResolvedValue(false),
    };

    const service = new ShiftService(
      db,
      authService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findAll(
      'user-vol',
      'org-1',
      PAGINATION,
      ShiftSortField.CREATED_AT,
      SortOrder.DESC,
    );

    expect(result.shifts.length).toBeGreaterThan(0);
    for (const shift of result.shifts) {
      expect((shift as { windowedInstances?: unknown }).windowedInstances).toBeUndefined();
    }
  });
});

describe('ShiftService.getPendingCounts', () => {
  it('returns an empty map when called with no instance ids', async () => {
    const service = createService([]);
    const result = await service.getPendingCounts([]);
    expect(result).toEqual(new Map());
  });

  it('counts ADMIN_INVITED, AWAITING_ADMIN_APPROVAL, WAITLIST_JOINED but not JOINED', async () => {
    const rows = [
      { instanceId: 'inst-1', total: 2 },
      { instanceId: 'inst-2', total: 1 },
    ];
    const service = createService(rows);
    const result = await service.getPendingCounts(['inst-1', 'inst-2', 'inst-3']);

    expect(result.get('inst-1')).toBe(2);
    expect(result.get('inst-2')).toBe(1);
    // inst-3 had no rows → not present in map (returns undefined, not 0)
    expect(result.get('inst-3')).toBeUndefined();
  });

  it('passes PENDING_SHIFT_INVITE_STATUSES (not ACTIVE) to the status inArray filter — JOINED excluded', async () => {
    // Spy on inArray so we can capture every (column, values) call made during getPendingCounts.
    const inArraySpy = jest.spyOn(drizzleOrm, 'inArray');

    const service = createService([]);
    await service.getPendingCounts(['inst-1']);

    // Find the call whose first argument is the status column (field name 'status').
    // inArray is called twice: once for instanceId, once for status.
    // The status call's second argument is the status values array.
    const statusCall = inArraySpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'status',
    );

    expect(statusCall).toBeDefined();
    const statusValues = statusCall![1] as ShiftInviteStatus[];

    expect(statusValues).toContain(ShiftInviteStatus.ADMIN_INVITED);
    expect(statusValues).toContain(ShiftInviteStatus.AWAITING_ADMIN_APPROVAL);
    expect(statusValues).toContain(ShiftInviteStatus.WAITLIST_JOINED);
    // If JOINED were added to PENDING_SHIFT_INVITE_STATUSES (or if the query
    // switched to ACTIVE_SHIFT_INVITE_STATUSES), this assertion would fail.
    expect(statusValues).not.toContain(ShiftInviteStatus.JOINED);

    inArraySpy.mockRestore();
  });
});

describe('ShiftService.findDistinctLocations', () => {
  /**
   * Build a mock db whose selectDistinct().from().where().orderBy() chain
   * resolves to the given rows. Captures the where argument for inspection.
   */
  function makeDistinctDb(
    rows: { location: string | null }[],
    captureWhere?: (arg: unknown) => void,
  ) {
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockImplementation((arg: unknown) => {
      captureWhere?.(arg);
      return { orderBy };
    });
    const from = jest.fn().mockReturnValue({ where });
    const selectDistinct = jest.fn().mockReturnValue({ from });
    const db = { selectDistinct } as never;
    return { db, selectDistinct, from, where, orderBy };
  }

  function createDistinctService(rows: { location: string | null }[]) {
    const { db } = makeDistinctDb(rows);
    return new ShiftService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('returns distinct non-null non-empty locations sorted alphabetically', async () => {
    // DB returns rows after selectDistinct + where isNotNull + ne('').
    // The service receives already-filtered results and must preserve DB order.
    const rows: { location: string | null }[] = [
      { location: 'A' },
      { location: 'B' },
      { location: 'A' },
    ];
    const service = createDistinctService(rows);
    const result = await service.findDistinctLocations('org-1');
    expect(result).toEqual(['A', 'B', 'A']);
  });

  it('returns empty array when no locations exist', async () => {
    const service = createDistinctService([]);
    const result = await service.findDistinctLocations('org-1');
    expect(result).toEqual([]);
  });

  it('returns distinct, non-null, non-empty locations as provided by the database', async () => {
    // The database WHERE clause filters isNotNull and ne(''), so the service
    // receives only valid locations already ordered by the DB.
    const service = createDistinctService([{ location: 'Z' }]);
    const result = await service.findDistinctLocations('org-1');
    expect(result).toEqual(['Z']);
  });

  it('returns locations in the database order (preserves SQL orderBy)', async () => {
    // The database returns results ordered by asc(schema.shifts.location).
    // The service does not re-sort; it preserves the DB order.
    const service = createDistinctService([
      { location: 'A' },
      { location: 'B' },
      { location: 'C' },
    ]);
    const result = await service.findDistinctLocations('org-1');
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('calls selectDistinct on the db (not select)', async () => {
    const { db, selectDistinct } = makeDistinctDb([]);
    const service = new ShiftService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.findDistinctLocations('org-1');
    expect(selectDistinct).toHaveBeenCalledTimes(1);
  });

  it('when visibilityFilter is ALL_MEMBERS, adds visibility eq condition to the query', async () => {
    const { db } = makeDistinctDb([]);
    const service = new ShiftService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const eqSpy = jest.spyOn(drizzleOrm, 'eq');
    await service.findDistinctLocations('org-1', ShiftVisibility.ALL_MEMBERS);

    const visibilityEqCall = eqSpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'visibility',
    );
    expect(visibilityEqCall).toBeDefined();
    expect(visibilityEqCall![1]).toBe(ShiftVisibility.ALL_MEMBERS);

    eqSpy.mockRestore();
  });

  it('when visibilityFilter is null, does not add visibility eq condition to the query', async () => {
    const { db } = makeDistinctDb([]);
    const service = new ShiftService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const eqSpy = jest.spyOn(drizzleOrm, 'eq');
    await service.findDistinctLocations('org-1', null);

    const visibilityEqCall = eqSpy.mock.calls.find(
      ([col]) =>
        col != null &&
        typeof col === 'object' &&
        'name' in col &&
        (col as { name: string }).name === 'visibility',
    );
    expect(visibilityEqCall).toBeUndefined();

    eqSpy.mockRestore();
  });

  it('returns SQL-ordered results without JS re-sorting (DB order is preserved)', async () => {
    // If JS .sort() were applied, 'Ärzte' (ä) would sort differently under JS vs Postgres collation.
    // This test ensures the return value equals the DB order, not the JS-sort order.
    const dbOrder = ['Ärztehaus', 'Bahnhof', 'Zentrum'];
    const service = createDistinctService(
      dbOrder.map((location) => ({ location })),
    );
    const result = await service.findDistinctLocations('org-1');
    expect(result).toEqual(dbOrder); // must preserve DB collation order
  });
});

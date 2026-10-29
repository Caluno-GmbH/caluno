import 'reflect-metadata';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PERMISSIONS } from '../src/auth/constants';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { ShiftInviteStatus, ShiftVisibility } from '../src/shift/enums';
import {
  createShift,
  createShiftInstanceInvite,
  createUser,
} from './factories';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  assignRoleToMembership,
  createRole,
  grantPermissionToRole,
} from './factories/role.factory';
import {
  applyBunAuthMocks,
  getAuthMockUserId,
  setAuthMockUserId,
} from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

type ShiftsResult = {
  shifts: {
    items: Array<{ id: string; instances: Array<{ id: string }> }>;
    pagination: { total: number };
  };
};

describe('shifts query list filters', () => {
  let app: INestApplication;
  let db: Database;
  let adminUserId: string;
  let organizationUnitId: string;
  let below: { id: string };
  let full: { id: string };
  let neutral: { id: string };
  let recurring: { id: string };
  let recurringBelowInstanceId: string;
  let recurringFullInstanceId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    adminUserId = getAuthMockUserId();

    const { organization, type } = await createOrganizationWithType(
      db,
      `Shift Filter Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    organizationUnitId = unit.id;

    const membership = await addMembership(db, adminUserId, unit.id);
    const role = await createRole(db, { organizationId: organization.id });
    const shiftViewPermission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.SHIFT_VIEW },
    });
    if (!shiftViewPermission) {
      throw new Error('SHIFT_VIEW permission not seeded in test database');
    }
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: shiftViewPermission.id,
    });
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    const base = Date.now() + 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    below = await createShift(db, {
      organizationUnitId,
      title: 'Below minimum',
      location: 'Open room',
      startsAt: new Date(base),
      endsAt: new Date(base + hour),
      minVolunteers: 1,
      maxVolunteers: 1,
    });
    full = await createShift(db, {
      organizationUnitId,
      title: 'Completely full',
      location: 'Invited room',
      startsAt: new Date(base + 2 * hour),
      endsAt: new Date(base + 3 * hour),
      visibility: ShiftVisibility.INVITED_MEMBERS,
      minVolunteers: 1,
      maxVolunteers: 1,
    });
    neutral = await createShift(db, {
      organizationUnitId,
      title: 'Between minimum and maximum',
      startsAt: new Date(base + 4 * hour),
      endsAt: new Date(base + 5 * hour),
      minVolunteers: 1,
      maxVolunteers: 2,
    });
    recurring = await createShift(db, {
      organizationUnitId,
      title: 'Mixed staffing',
      startsAt: new Date(base + 6 * hour),
      endsAt: new Date(base + 7 * hour),
      rrule: 'FREQ=WEEKLY;COUNT=2',
      minVolunteers: 1,
      maxVolunteers: 1,
    });

    const volunteer = await createUser(db);
    const [fullInstance] = await db.query.shiftInstances.findMany({
      where: { masterId: full.id },
    });
    const [neutralInstance] = await db.query.shiftInstances.findMany({
      where: { masterId: neutral.id },
    });
    const recurringInstances = await db.query.shiftInstances.findMany({
      where: { masterId: recurring.id },
      orderBy: { actualStartsAt: 'asc' },
    });
    if (!fullInstance || !neutralInstance || recurringInstances.length !== 2) {
      throw new Error('Expected shift instances were not created');
    }
    const [firstRecurring, secondRecurring] = recurringInstances;
    if (!firstRecurring || !secondRecurring) {
      throw new Error('Expected two recurring shift instances');
    }
    recurringBelowInstanceId = firstRecurring.id;
    recurringFullInstanceId = secondRecurring.id;

    for (const instanceId of [
      fullInstance.id,
      neutralInstance.id,
      secondRecurring.id,
    ]) {
      await createShiftInstanceInvite(db, {
        instanceId,
        userId: volunteer.id,
        status: ShiftInviteStatus.JOINED,
      });
    }

    const otherUnit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'other',
      parentId: unit.id,
    });
    await createShift(db, {
      organizationUnitId: otherUnit.id,
      title: 'Other unit shift',
      location: 'Other room',
      startsAt: new Date(base),
      endsAt: new Date(base + hour),
    });
  });

  afterAll(() => {
    setAuthMockUserId(adminUserId);
  });

  const queryShifts = (variables: Record<string, unknown> = {}) =>
    graphqlRequestRequiringData<ShiftsResult>(
      app,
      {
        query: `
          query Shifts($limit: Int!, $offset: Int!, $fill: ShiftFillFilter, $dateFrom: DateTime, $dateTo: DateTime, $location: String, $visibility: ShiftVisibility) {
            shifts(limit: $limit, offset: $offset, fill: $fill, dateFrom: $dateFrom, dateTo: $dateTo, location: $location, visibility: $visibility) {
              items { id instances { id } }
              pagination { total }
            }
          }
        `,
        variables: { limit: 10, offset: 0, ...variables },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shifts',
    );

  it('filters understaffed masters and instances before pagination', async () => {
    const data = await queryShifts({ fill: 'BELOW', limit: 1 });

    expect(data.shifts.pagination.total).toBe(2);
    expect(data.shifts.items).toHaveLength(1);

    const all = await queryShifts({ fill: 'BELOW' });
    expect(all.shifts.items.map((shift) => shift.id).sort()).toEqual(
      [below.id, recurring.id].sort(),
    );
    expect(
      all.shifts.items.find((shift) => shift.id === recurring.id)?.instances,
    ).toEqual([{ id: recurringBelowInstanceId }]);
  });

  it('filters full masters and instances before pagination', async () => {
    const data = await queryShifts({ fill: 'FULL' });

    expect(data.shifts.pagination.total).toBe(2);
    expect(data.shifts.items.map((shift) => shift.id).sort()).toEqual(
      [full.id, recurring.id].sort(),
    );
    expect(
      data.shifts.items.find((shift) => shift.id === recurring.id)?.instances,
    ).toEqual([{ id: recurringFullInstanceId }]);
    expect(data.shifts.items.some((shift) => shift.id === neutral.id)).toBe(
      false,
    );
  });

  it('includes the entire selected app-timezone day', async () => {
    const from = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const date = from.toISOString().slice(0, 10);
    const late = await createShift(db, {
      organizationUnitId,
      title: 'Late in selected day',
      startsAt: new Date(`${date}T21:59:00.000Z`),
      endsAt: new Date(`${date}T22:30:00.000Z`),
    });

    const data = await queryShifts({
      dateFrom: `${date}T00:00:00.000Z`,
      dateTo: `${date}T00:00:00.000Z`,
    });
    expect(data.shifts.items.map((shift) => shift.id)).toEqual([late.id]);
    expect(data.shifts.pagination.total).toBe(1);
  });

  it('includes the early hours of the selected app-timezone start day', async () => {
    const day = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const date = day.toISOString().slice(0, 10);
    const previous = new Date(day.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    // 23:30 UTC the evening before is 00:30/01:30 on `date` in Berlin.
    const early = await createShift(db, {
      organizationUnitId,
      title: 'Early in selected day',
      startsAt: new Date(`${previous}T23:30:00.000Z`),
      endsAt: new Date(`${previous}T23:45:00.000Z`),
    });

    const data = await queryShifts({
      dateFrom: `${date}T00:00:00.000Z`,
      dateTo: `${date}T00:00:00.000Z`,
    });
    expect(data.shifts.items.map((shift) => shift.id)).toEqual([early.id]);
  });

  it('runs the default window from a start date beyond the next 31 days', async () => {
    const day = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const date = day.toISOString().slice(0, 10);
    const later = await createShift(db, {
      organizationUnitId,
      title: 'Far out',
      startsAt: new Date(`${date}T10:00:00.000Z`),
      endsAt: new Date(`${date}T11:00:00.000Z`),
    });

    const data = await queryShifts({ dateFrom: `${date}T00:00:00.000Z` });
    expect(data.shifts.items.map((shift) => shift.id)).toEqual([later.id]);
  });

  it('filters by location and visibility without returning another unit', async () => {
    const data = await queryShifts({
      location: 'Invited room',
      visibility: ShiftVisibility.INVITED_MEMBERS,
    });

    expect(data.shifts.items.map((shift) => shift.id)).toEqual([full.id]);
    expect(data.shifts.pagination.total).toBe(1);
  });

  it('offers locations for every shift visible to SHIFT_VIEW callers', async () => {
    const data = await graphqlRequestRequiringData<{
      shiftLocations: string[];
    }>(
      app,
      {
        query: 'query { shiftLocations }',
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shiftLocations',
    );

    expect(data.shiftLocations).toEqual(['Invited room', 'Open room']);
  });

  it('filters and offers locations by an instance override', async () => {
    const recurringInstances = await db.query.shiftInstances.findMany({
      where: { masterId: recurring.id },
    });
    const overridden = recurringInstances.find(
      (instance) => instance.id === recurringFullInstanceId,
    );
    if (!overridden) throw new Error('Expected the recurring full instance');
    await db
      .update(schema.shiftInstances)
      .set({ overrideLocation: 'Annex' })
      .where(eq(schema.shiftInstances.id, overridden.id));

    const data = await queryShifts({ location: 'Annex' });
    expect(data.shifts.items.map((shift) => shift.id)).toEqual([recurring.id]);
    expect(data.shifts.items[0]?.instances).toEqual([
      { id: recurringFullInstanceId },
    ]);

    const locations = await graphqlRequestRequiringData<{
      shiftLocations: string[];
    }>(
      app,
      {
        query: 'query { shiftLocations }',
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shiftLocations',
    );
    expect(locations.shiftLocations).toContain('Annex');

    await db
      .update(schema.shiftInstances)
      .set({ overrideLocation: null })
      .where(eq(schema.shiftInstances.id, overridden.id));
  });

  it('counts every shift in the unit regardless of the list date window', async () => {
    const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await createShift(db, {
      organizationUnitId,
      title: 'Long past',
      startsAt: past,
      endsAt: new Date(past.getTime() + 60 * 60 * 1000),
    });
    const unitShifts = await db.query.shifts.findMany({
      where: { organizationUnitId, isDeleted: false },
    });

    const data = await graphqlRequestRequiringData<{ shiftCount: number }>(
      app,
      {
        query: 'query { shiftCount }',
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shiftCount',
    );
    const windowed = await queryShifts();

    expect(data.shiftCount).toBe(unitShifts.length);
    expect(data.shiftCount).toBeGreaterThan(windowed.shifts.pagination.total);
  });
});

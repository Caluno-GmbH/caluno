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
import { PERMISSIONS } from '../src/auth/constants';
import type { Database } from '../src/database/database.module';
import { ShiftVisibility } from '../src/shift/enums';
import { createShift, createUser } from './factories';
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
    items: Array<{ id: string }>;
    pagination: { total: number };
  };
};

describe('shifts query sort + search (VOLI-1625)', () => {
  let app: INestApplication;
  let db: Database;
  let adminUserId: string;
  let organizationUnitId: string;
  let alpha: { id: string };
  let bravo: { id: string };
  let charlie: { id: string };

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    adminUserId = getAuthMockUserId();

    // Fresh unit so shifts seeded by other suites don't leak into totals.
    const { organization, type } = await createOrganizationWithType(
      db,
      `Shift Sort Org ${crypto.randomUUID()}`,
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
    // Titles, dates and visibilities deliberately disagree in order so each
    // sort field produces a distinct sequence.
    charlie = await createShift(db, {
      organizationUnitId,
      title: 'Charlie reading',
      location: 'Library',
      startsAt: new Date(base),
      endsAt: new Date(base + hour),
      visibility: ShiftVisibility.ALL_MEMBERS,
    });
    alpha = await createShift(db, {
      organizationUnitId,
      title: 'Alpha reading',
      location: 'Town hall',
      startsAt: new Date(base + 2 * hour),
      endsAt: new Date(base + 3 * hour),
      visibility: ShiftVisibility.INVITED_MEMBERS,
    });
    bravo = await createShift(db, {
      organizationUnitId,
      title: 'Bravo sorting',
      location: 'Reading room',
      startsAt: new Date(base + 4 * hour),
      endsAt: new Date(base + 5 * hour),
      visibility: ShiftVisibility.ALL_MEMBERS,
    });
  });

  afterAll(() => {
    setAuthMockUserId(adminUserId);
  });

  const queryShifts = (variables: Record<string, unknown>) =>
    graphqlRequestRequiringData<ShiftsResult>(
      app,
      {
        query: `
          query Shifts($limit: Int!, $offset: Int!, $sort: ShiftSortField, $order: SortOrder, $search: String) {
            shifts(limit: $limit, offset: $offset, sort: $sort, order: $order, search: $search) {
              items { id }
              pagination { total }
            }
          }
        `,
        variables: { limit: 10, offset: 0, ...variables },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'shifts',
    );

  const ids = (data: ShiftsResult) => data.shifts.items.map((s) => s.id);

  it('sorts by title in both directions', async () => {
    const asc = await queryShifts({ sort: 'TITLE', order: 'ASC' });
    expect(ids(asc)).toEqual([alpha.id, bravo.id, charlie.id]);

    const desc = await queryShifts({ sort: 'TITLE', order: 'DESC' });
    expect(ids(desc)).toEqual([charlie.id, bravo.id, alpha.id]);
  });

  it('sorts by first date in both directions', async () => {
    const asc = await queryShifts({ sort: 'FIRST_DATE', order: 'ASC' });
    expect(ids(asc)).toEqual([charlie.id, alpha.id, bravo.id]);

    const desc = await queryShifts({ sort: 'FIRST_DATE', order: 'DESC' });
    expect(ids(desc)).toEqual([bravo.id, alpha.id, charlie.id]);
  });

  it('sorts by visibility with a stable id tie-breaker', async () => {
    const asc = await queryShifts({ sort: 'VISIBILITY', order: 'ASC' });
    const desc = await queryShifts({ sort: 'VISIBILITY', order: 'DESC' });

    const tied = [charlie.id, bravo.id].sort();
    // Equal visibilities keep `id asc` order in both directions.
    expect(ids(asc).filter((id) => id !== alpha.id)).toEqual(tied);
    expect(ids(desc).filter((id) => id !== alpha.id)).toEqual(tied);
    // The odd one out flips ends when the direction flips.
    expect(ids(asc).indexOf(alpha.id)).toBe(2 - ids(desc).indexOf(alpha.id));
  });

  it('pages through a sort without repeating or skipping rows', async () => {
    const first = await queryShifts({ sort: 'VISIBILITY', limit: 2 });
    const second = await queryShifts({
      sort: 'VISIBILITY',
      limit: 2,
      offset: 2,
    });
    expect(new Set([...ids(first), ...ids(second)]).size).toBe(3);
  });

  it('searches title and location case-insensitively', async () => {
    const data = await queryShifts({
      search: '  READING ',
      sort: 'TITLE',
      order: 'ASC',
    });
    // Alpha + Charlie match on title, Bravo on location ("Reading room").
    expect(ids(data)).toEqual([alpha.id, bravo.id, charlie.id]);

    const byLocation = await queryShifts({ search: 'town hall' });
    expect(ids(byLocation)).toEqual([alpha.id]);
  });

  it('counts only the filtered set', async () => {
    const data = await queryShifts({ search: 'sorting', limit: 1 });
    expect(ids(data)).toEqual([bravo.id]);
    expect(data.shifts.pagination.total).toBe(1);

    const none = await queryShifts({ search: 'no such shift' });
    expect(none.shifts.items).toHaveLength(0);
    expect(none.shifts.pagination.total).toBe(0);
  });

  it('ignores search for members without SHIFT_VIEW', async () => {
    const member = await createUser(db);
    await addMembership(db, member.id, organizationUnitId);
    setAuthMockUserId(member.id);
    try {
      const data = await queryShifts({ search: 'no such shift' });
      // Member path is unchanged: open shifts stay visible, invite-only hidden.
      expect(ids(data).sort()).toEqual([bravo.id, charlie.id].sort());
      expect(data.shifts.pagination.total).toBe(2);
    } finally {
      setAuthMockUserId(adminUserId);
    }
  });
});

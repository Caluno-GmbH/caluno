import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
  spyOn,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PERMISSIONS } from '../src/auth/constants';
import { PERMISSIONS_KEY } from '../src/auth/decorators/permissions.decorator';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { ShiftInviteStatus } from '../src/shift/enums';
import { ShiftMutationResolver } from '../src/shift/resolvers/shift-mutation.resolver';
import { ShiftQueryResolver } from '../src/shift/resolvers/shift-query.resolver';
import { ShiftService } from '../src/shift/shift.service';
import {
  createShift,
  createShiftInstance,
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
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import {
  graphqlRequest,
  graphqlRequestRequiringData,
} from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const CHECK_IN_SHIFT_INSTANCES = `
  query CheckInShiftInstances($startsAfter: DateTime!, $endsBefore: DateTime!) {
    checkInShiftInstances(startsAfter: $startsAfter, endsBefore: $endsBefore) {
      id
      actualStartsAt
      master { id title }
    }
  }
`;

describe('checkInShiftInstances query', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  /** A unit where the caller holds check-in:manage and nothing else. */
  let checkInOnlyUnitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;

    const org = await createOrganizationWithType(
      db,
      `CheckInOnly ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Check-in only unit',
    });
    checkInOnlyUnitId = unit.id;

    const permission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.CHECK_IN_MANAGE },
    });
    if (!permission) throw new Error('CHECK_IN_MANAGE permission not seeded');

    const role = await createRole(db, {
      organizationId: org.organization.id,
    });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: permission.id,
    });
    const membership = await addMembership(db, testUserId, unit.id);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('returns instances for a caller holding only check-in:manage', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const shift = await createShift(db, {
      organizationUnitId: checkInOnlyUnitId,
      title: `Soup kitchen ${crypto.randomUUID()}`,
      startsAt,
      endsAt,
    });

    const data = await graphqlRequestRequiringData<{
      checkInShiftInstances: Array<{ master: { id: string; title: string } }>;
    }>(
      app,
      {
        query: CHECK_IN_SHIFT_INSTANCES,
        variables: {
          startsAfter: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endsBefore: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        headers: { 'x-organization-unit-id': checkInOnlyUnitId },
      },
      'checkInShiftInstances',
    );

    expect(data.checkInShiftInstances.map((i) => i.master.id)).toContain(
      shift.id,
    );
  });

  it('does not return instances from another org unit', async () => {
    const other = await createOrganizationWithType(
      db,
      `Other ${crypto.randomUUID()}`,
    );
    const otherUnit = await createUnit(db, {
      organizationId: other.organization.id,
      typeId: other.type.id,
      name: 'Other unit',
    });
    const foreignShift = await createShift(db, {
      organizationUnitId: otherUnit.id,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const data = await graphqlRequestRequiringData<{
      checkInShiftInstances: Array<{ master: { id: string } }>;
    }>(
      app,
      {
        query: CHECK_IN_SHIFT_INSTANCES,
        variables: {
          startsAfter: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endsBefore: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        headers: { 'x-organization-unit-id': checkInOnlyUnitId },
      },
      'checkInShiftInstances',
    );

    expect(data.checkInShiftInstances.map((i) => i.master.id)).not.toContain(
      foreignShift.id,
    );
  });
});

/**
 * The integration harness stubs `PermissionGuard.prototype.canActivate` to
 * always-true (`test/helpers/create-graphql-full-app.ts:20`), so a rejection
 * cannot be provoked through a GraphQL request. Assert the decorator instead:
 * this fails if anyone drops or weakens the guard on these queries.
 */
describe('check-in query permissions', () => {
  it('gates checkInShiftInstances on check-in:manage', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ShiftQueryResolver.prototype.checkInShiftInstances,
      ),
    ).toEqual([PERMISSIONS.CHECK_IN_MANAGE]);
  });

  it('gates checkInShifts on check-in:manage', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ShiftQueryResolver.prototype.checkInShifts,
      ),
    ).toEqual([PERMISSIONS.CHECK_IN_MANAGE]);
  });
});

describe('check-in mutation permissions', () => {
  it('gates checkInAddToShiftInstance on check-in:manage', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ShiftMutationResolver.prototype.checkInAddToShiftInstance,
      ),
    ).toEqual([PERMISSIONS.CHECK_IN_MANAGE]);
  });
});

describe('checkInShifts query', () => {
  const CHECK_IN_SHIFTS = `
    query CheckInShifts($search: String) {
      checkInShifts(search: $search) {
        id
        title
      }
    }
  `;

  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  let unitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;

    const org = await createOrganizationWithType(
      db,
      `Search ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Search unit',
    });
    unitId = unit.id;

    const permission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.CHECK_IN_MANAGE },
    });
    if (!permission) throw new Error('CHECK_IN_MANAGE permission not seeded');

    const role = await createRole(db, {
      organizationId: org.organization.id,
    });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: permission.id,
    });
    const membership = await addMembership(db, testUserId, unit.id);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('matches shift titles case-insensitively', async () => {
    const shift = await createShift(db, {
      organizationUnitId: unitId,
      title: 'Soup Kitchen 2nd shift',
    });
    await createShift(db, {
      organizationUnitId: unitId,
      title: 'Gardening crew',
    });

    const data = await graphqlRequestRequiringData<{
      checkInShifts: Array<{ id: string; title: string }>;
    }>(
      app,
      {
        query: CHECK_IN_SHIFTS,
        variables: { search: 'soup kitchen' },
        headers: { 'x-organization-unit-id': unitId },
      },
      'checkInShifts',
    );

    expect(data.checkInShifts.map((s) => s.id)).toEqual([shift.id]);
  });
});

describe('checkInAddToShiftInstance mutation', () => {
  const CHECK_IN_ADD_TO_SHIFT_INSTANCE = `
    mutation CheckInAddToShiftInstance(
      $checkInId: String!
      $shiftInstanceId: ID!
      $allowOverCapacity: Boolean! = false
    ) {
      checkInAddToShiftInstance(
        checkInId: $checkInId
        shiftInstanceId: $shiftInstanceId
        allowOverCapacity: $allowOverCapacity
      ) {
        id
      }
    }
  `;

  let app: INestApplication;
  let db: Database;
  let callerUserId: string;
  let unitId: string;
  let joinedNotificationSpy: ReturnType<typeof spyOn>;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    callerUserId = context.testUserId;

    const org = await createOrganizationWithType(
      db,
      `AddToShift ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Add to shift unit',
    });
    unitId = unit.id;

    const permission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.CHECK_IN_MANAGE },
    });
    if (!permission) throw new Error('CHECK_IN_MANAGE permission not seeded');

    const role = await createRole(db, { organizationId: org.organization.id });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: permission.id,
    });
    const membership = await addMembership(db, callerUserId, unit.id);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    // The shift-manager notification is fire-and-forget on a private method;
    // stub it so the assertions below stay deterministic.
    joinedNotificationSpy = spyOn(
      app.get(ShiftService) as unknown as {
        notifyShiftInstanceJoined: () => Promise<void>;
      },
      'notifyShiftInstanceJoined',
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    joinedNotificationSpy.mockClear();
    setAuthMockUserId(callerUserId);
  });

  const addToShift = (
    checkInId: string,
    shiftInstanceId: string,
    allowOverCapacity?: boolean,
  ) =>
    graphqlRequest(app, {
      query: CHECK_IN_ADD_TO_SHIFT_INSTANCE,
      variables: {
        checkInId,
        shiftInstanceId,
        ...(allowOverCapacity === undefined ? {} : { allowOverCapacity }),
      },
      headers: { 'x-organization-unit-id': unitId },
    });

  const addMember = async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, unitId);
    return volunteer;
  };

  const inviteStatus = async (instanceId: string, userId: string) =>
    (
      await db.query.shiftInstanceInvites.findFirst({
        where: { instanceId, userId },
      })
    )?.status;

  const participantCount = async (instanceId: string) =>
    (
      await db.query.shiftInstanceInvites.findMany({
        where: { instanceId, status: ShiftInviteStatus.JOINED },
      })
    ).length;

  it('joins a member who has no invite yet and notifies shift managers', async () => {
    const shift = await createShift(db, { organizationUnitId: unitId });
    const instance = await createShiftInstance(db, shift.id);
    const volunteer = await addMember();

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors).toBeUndefined();
    expect(await inviteStatus(instance.id, volunteer.id)).toBe(
      ShiftInviteStatus.JOINED,
    );
    expect(joinedNotificationSpy).toHaveBeenCalledTimes(1);
  });

  for (const status of [
    ShiftInviteStatus.ADMIN_INVITED,
    ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    ShiftInviteStatus.WAITLIST_JOINED,
    ShiftInviteStatus.VOLUNTEER_CANCELLED,
  ]) {
    it(`moves an existing ${status} invite to JOINED`, async () => {
      const shift = await createShift(db, { organizationUnitId: unitId });
      const instance = await createShiftInstance(db, shift.id);
      const volunteer = await addMember();
      await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: volunteer.id,
        status,
      });

      const response = await addToShift(volunteer.checkInId, instance.id);

      expect(response.errors).toBeUndefined();
      expect(await inviteStatus(instance.id, volunteer.id)).toBe(
        ShiftInviteStatus.JOINED,
      );
    });
  }

  it('is a no-op for a volunteer who already joined', async () => {
    const shift = await createShift(db, {
      organizationUnitId: unitId,
      maxVolunteers: 1,
    });
    const instance = await createShiftInstance(db, shift.id);
    const volunteer = await addMember();
    await createShiftInstanceInvite(db, {
      instanceId: instance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.JOINED,
    });

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors).toBeUndefined();
    expect(await participantCount(instance.id)).toBe(1);
    expect(joinedNotificationSpy).not.toHaveBeenCalled();
  });

  it('joins directly even when the shift requires join approval', async () => {
    const shift = await createShift(db, { organizationUnitId: unitId });
    await db
      .update(schema.shifts)
      .set({ joinRequiresApproval: true })
      .where(eq(schema.shifts.id, shift.id));
    const instance = await createShiftInstance(db, shift.id);
    const volunteer = await addMember();

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors).toBeUndefined();
    expect(await inviteStatus(instance.id, volunteer.id)).toBe(
      ShiftInviteStatus.JOINED,
    );
  });

  describe('capacity', () => {
    const setupFullInstance = async () => {
      const shift = await createShift(db, {
        organizationUnitId: unitId,
        maxVolunteers: 1,
      });
      const instance = await createShiftInstance(db, shift.id);
      const occupant = await createUser(db);
      await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: occupant.id,
        status: ShiftInviteStatus.JOINED,
      });
      return instance;
    };

    it('rejects with CONFLICT when full and allowOverCapacity is false', async () => {
      const instance = await setupFullInstance();
      const volunteer = await addMember();

      const response = await addToShift(volunteer.checkInId, instance.id);

      expect(response.errors?.[0]?.extensions?.code).toBe('CONFLICT');
      expect(response.errors?.[0]?.message).toBe(
        'Shift instance is at full capacity',
      );
      expect(await inviteStatus(instance.id, volunteer.id)).toBeUndefined();
    });

    it('fills the last seat only once under concurrent adds', async () => {
      const shift = await createShift(db, {
        organizationUnitId: unitId,
        maxVolunteers: 1,
      });
      const instance = await createShiftInstance(db, shift.id);
      const first = await addMember();
      const second = await addMember();

      const responses = await Promise.all([
        addToShift(first.checkInId, instance.id),
        addToShift(second.checkInId, instance.id),
      ]);

      const codes = responses
        .map((response) => response.errors?.[0]?.extensions?.code ?? 'OK')
        .sort();
      expect(codes).toEqual(['CONFLICT', 'OK']);
      expect(await participantCount(instance.id)).toBe(1);
    });

    it('joins past the cap with allowOverCapacity', async () => {
      const instance = await setupFullInstance();
      const volunteer = await addMember();

      const response = await addToShift(volunteer.checkInId, instance.id, true);

      expect(response.errors).toBeUndefined();
      expect(await inviteStatus(instance.id, volunteer.id)).toBe(
        ShiftInviteStatus.JOINED,
      );
      expect(await participantCount(instance.id)).toBe(2);
    });
  });

  it('leaves other waitlisted invites unchanged and does not notify them', async () => {
    const shift = await createShift(db, {
      organizationUnitId: unitId,
      maxVolunteers: 2,
    });
    const instance = await createShiftInstance(db, shift.id);
    const waitlisted = await addMember();
    await createShiftInstanceInvite(db, {
      instanceId: instance.id,
      userId: waitlisted.id,
      status: ShiftInviteStatus.WAITLIST_JOINED,
    });
    const volunteer = await addMember();

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors).toBeUndefined();
    expect(await inviteStatus(instance.id, waitlisted.id)).toBe(
      ShiftInviteStatus.WAITLIST_JOINED,
    );
    expect(joinedNotificationSpy).toHaveBeenCalledTimes(1);
    expect(joinedNotificationSpy.mock.calls[0]?.[0]).toBe(volunteer.id);
  });

  it('rejects a volunteer who is not a member of the unit', async () => {
    const shift = await createShift(db, { organizationUnitId: unitId });
    const instance = await createShiftInstance(db, shift.id);
    const volunteer = await createUser(db); // no membership anywhere

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(await inviteStatus(instance.id, volunteer.id)).toBeUndefined();
  });

  it('rejects an unknown check-in ID with NOT_FOUND', async () => {
    const shift = await createShift(db, { organizationUnitId: unitId });
    const instance = await createShiftInstance(db, shift.id);

    const response = await addToShift('no-such-check-in-id', instance.id);

    expect(response.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('rejects a cancelled instance with NOT_FOUND', async () => {
    const shift = await createShift(db, { organizationUnitId: unitId });
    const instance = await createShiftInstance(db, shift.id, {
      isCancelled: true,
    });
    const volunteer = await addMember();

    const response = await addToShift(volunteer.checkInId, instance.id);

    expect(response.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    expect(await inviteStatus(instance.id, volunteer.id)).toBeUndefined();
  });

  it('rejects an instance that belongs to a different org unit with NOT_FOUND', async () => {
    const otherOrg = await createOrganizationWithType(
      db,
      `OtherAddToShift ${crypto.randomUUID()}`,
    );
    const otherUnit = await createUnit(db, {
      organizationId: otherOrg.organization.id,
      typeId: otherOrg.type.id,
      name: 'Other add to shift unit',
    });
    const foreignShift = await createShift(db, {
      organizationUnitId: otherUnit.id,
    });
    const foreignInstance = await createShiftInstance(db, foreignShift.id);
    const volunteer = await addMember();

    const response = await addToShift(volunteer.checkInId, foreignInstance.id);

    expect(response.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    expect(
      await inviteStatus(foreignInstance.id, volunteer.id),
    ).toBeUndefined();
  });
});

import 'reflect-metadata';
import {
  afterAll,
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
import { and, eq } from 'drizzle-orm';
import { PERMISSIONS } from '../src/auth/constants';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { NotificationService } from '../src/notification';
import { EmailService } from '../src/notification/email/email.service';
import { createMembershipRequest, createUser } from './factories';
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

const CHECK_IN_INVITE_TO_ORGANIZATION = `
  mutation CheckInInviteToOrganization($checkInId: String!) {
    checkInInviteToOrganization(checkInId: $checkInId)
  }
`;

describe('checkInInviteToOrganization cooldown', () => {
  let app: INestApplication;
  let db: Database;
  let callerUserId: string;
  let unitId: string;
  let otherUnitId: string;
  let notifySpy: ReturnType<typeof spyOn>;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    callerUserId = context.testUserId;

    const org = await createOrganizationWithType(
      db,
      `OrgInviteCooldown ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Invite cooldown unit',
    });
    const otherUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Invite cooldown other unit',
      parentId: unit.id,
    });
    unitId = unit.id;
    otherUnitId = otherUnit.id;

    const permission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.CHECK_IN_MANAGE },
    });
    if (!permission) throw new Error('CHECK_IN_MANAGE permission not seeded');

    const role = await createRole(db, { organizationId: org.organization.id });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: permission.id,
    });
    for (const id of [unit.id, otherUnit.id]) {
      const membership = await addMembership(db, callerUserId, id);
      await assignRoleToMembership(db, {
        membershipId: membership.id,
        roleId: role.id,
      });
    }

    notifySpy = spyOn(
      app.get(NotificationService),
      'notifyOrganizationUnitInvited',
    ).mockImplementation(async () => {});
  });

  afterEach(() => {
    notifySpy.mockClear();
    setAuthMockUserId(callerUserId);
  });

  afterAll(() => {
    notifySpy.mockRestore();
  });

  const invite = async (checkInId: string, organizationUnitId = unitId) => {
    const data = await graphqlRequestRequiringData<{
      checkInInviteToOrganization: boolean;
    }>(
      app,
      {
        query: CHECK_IN_INVITE_TO_ORGANIZATION,
        variables: { checkInId },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'checkInInviteToOrganization',
    );
    return data.checkInInviteToOrganization;
  };

  it('sends the first invite', async () => {
    const volunteer = await createUser(db);

    expect(await invite(volunteer.checkInId)).toBe(true);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('skips a second invite within the cooldown but still returns true', async () => {
    const volunteer = await createUser(db);

    expect(await invite(volunteer.checkInId)).toBe(true);
    expect(await invite(volunteer.checkInId)).toBe(true);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('sends again once the cooldown has elapsed', async () => {
    const volunteer = await createUser(db);

    await invite(volunteer.checkInId);
    await db
      .update(schema.organizationUnitInvitations)
      .set({ lastSentAt: new Date(Date.now() - 11 * 60_000) })
      .where(
        and(
          eq(schema.organizationUnitInvitations.userId, volunteer.id),
          eq(schema.organizationUnitInvitations.organizationUnitId, unitId),
        ),
      );

    expect(await invite(volunteer.checkInId)).toBe(true);
    expect(notifySpy).toHaveBeenCalledTimes(2);
  });

  it('sends only once for concurrent invites', async () => {
    const volunteer = await createUser(db);

    const results = await Promise.all([
      invite(volunteer.checkInId),
      invite(volunteer.checkInId),
    ]);

    expect(results).toEqual([true, true]);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('tracks the cooldown per organization unit', async () => {
    const volunteer = await createUser(db);

    await invite(volunteer.checkInId, unitId);
    await invite(volunteer.checkInId, otherUnitId);

    expect(notifySpy).toHaveBeenCalledTimes(2);
  });

  it('releases the claim and reports an error when dispatch fails, so an immediate retry sends', async () => {
    const volunteer = await createUser(db);
    notifySpy.mockImplementationOnce(async () => {
      throw new Error('dispatch failed');
    });

    const failed = await graphqlRequest(app, {
      query: CHECK_IN_INVITE_TO_ORGANIZATION,
      variables: { checkInId: volunteer.checkInId },
      headers: { 'x-organization-unit-id': unitId },
    });
    expect(failed.errors?.[0]).toBeDefined();

    expect(await invite(volunteer.checkInId)).toBe(true);
    expect(notifySpy).toHaveBeenCalledTimes(2);
  });

  describe('a volunteer who is already related', () => {
    const invitationRow = async (userId: string, organizationUnitId: string) =>
      (
        await db
          .select()
          .from(schema.organizationUnitInvitations)
          .where(
            and(
              eq(schema.organizationUnitInvitations.userId, userId),
              eq(
                schema.organizationUnitInvitations.organizationUnitId,
                organizationUnitId,
              ),
            ),
          )
      )[0];

    it('skips a member of the unit without claiming the cooldown', async () => {
      const volunteer = await createUser(db);
      await addMembership(db, volunteer.id, unitId);

      expect(await invite(volunteer.checkInId)).toBe(true);
      expect(notifySpy).not.toHaveBeenCalled();
      expect(await invitationRow(volunteer.id, unitId)).toBeUndefined();
    });

    it('skips a member of an ancestor unit', async () => {
      const volunteer = await createUser(db);
      await addMembership(db, volunteer.id, unitId);

      expect(await invite(volunteer.checkInId, otherUnitId)).toBe(true);
      expect(notifySpy).not.toHaveBeenCalled();
      expect(await invitationRow(volunteer.id, otherUnitId)).toBeUndefined();
    });

    it('skips a volunteer with a pending request to the unit', async () => {
      const volunteer = await createUser(db);
      await createMembershipRequest(db, {
        userId: volunteer.id,
        organizationUnitId: unitId,
      });

      expect(await invite(volunteer.checkInId)).toBe(true);
      expect(notifySpy).not.toHaveBeenCalled();
      expect(await invitationRow(volunteer.id, unitId)).toBeUndefined();
    });

    it('skips a volunteer with a pending request to an ancestor unit', async () => {
      const volunteer = await createUser(db);
      await createMembershipRequest(db, {
        userId: volunteer.id,
        organizationUnitId: unitId,
      });

      expect(await invite(volunteer.checkInId, otherUnitId)).toBe(true);
      expect(notifySpy).not.toHaveBeenCalled();
      expect(await invitationRow(volunteer.id, otherUnitId)).toBeUndefined();
    });
  });

  it('rejects an unknown check-in id', async () => {
    const response = await graphqlRequest(app, {
      query: CHECK_IN_INVITE_TO_ORGANIZATION,
      variables: { checkInId: crypto.randomUUID() },
      headers: { 'x-organization-unit-id': unitId },
    });

    expect(response.errors?.[0]?.message).toBe('Volunteer not found');
    expect(notifySpy).not.toHaveBeenCalled();
  });
});

describe('checkInInviteToOrganization email dispatch', () => {
  let app: INestApplication;
  let db: Database;
  let unitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;

    const org = await createOrganizationWithType(
      db,
      `OrgInviteDispatch ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Invite dispatch unit',
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
    const membership = await addMembership(db, context.testUserId, unit.id);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
  });

  it('surfaces a failed email enqueue to the caller and lets an immediate retry send', async () => {
    const volunteer = await createUser(db);
    const sendSpy = spyOn(app.get(EmailService), 'send');
    sendSpy.mockImplementationOnce(async () => {
      throw new Error('outbox unavailable');
    });
    sendSpy.mockImplementationOnce(async () => {});

    try {
      const failed = await graphqlRequest(app, {
        query: CHECK_IN_INVITE_TO_ORGANIZATION,
        variables: { checkInId: volunteer.checkInId },
        headers: { 'x-organization-unit-id': unitId },
      });
      expect(failed.errors?.[0]).toBeDefined();

      const retried = await graphqlRequestRequiringData<{
        checkInInviteToOrganization: boolean;
      }>(
        app,
        {
          query: CHECK_IN_INVITE_TO_ORGANIZATION,
          variables: { checkInId: volunteer.checkInId },
          headers: { 'x-organization-unit-id': unitId },
        },
        'checkInInviteToOrganization',
      );
      expect(retried.checkInInviteToOrganization).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    } finally {
      sendSpy.mockRestore();
    }
  });
});

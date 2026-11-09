import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
} from '../src/auth/constants';
import { PermissionKey } from '../src/auth/enums';
import type { Database } from '../src/database/database.module';
import { createMembershipRequest } from './factories/membership-request.factory';
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
import { createUser } from './factories/user.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const UPDATE_MEMBERSHIP_ROLES = `
  mutation UpdateMembershipRoles($membershipId: ID!, $roleIds: [ID!]!) {
    updateMembershipRoles(membershipId: $membershipId, roleIds: $roleIds) {
      id
    }
  }
`;

const REMOVE_MEMBERSHIP = `
  mutation RemoveMembership($id: ID!) {
    removeMembership(id: $id) {
      id
    }
  }
`;

const LEAVE_MEMBERSHIP = `
  mutation LeaveMembership($id: ID!) {
    leaveMembership(id: $id) {
      id
    }
  }
`;

const APPROVE_MEMBERSHIP_REQUEST = `
  mutation ApproveMembershipRequest($id: ID!, $organizationUnitId: ID!) {
    approveMembershipRequest(id: $id, organizationUnitId: $organizationUnitId) {
      id
    }
  }
`;

describe('role assignment and membership removal escalation rules', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  let unitId: string;
  let organizationId: string;
  let ownerRoleId: string;
  let memberRoleId: string;
  let helperRoleId: string;
  let editorUserId: string;
  let editorMembershipId: string;
  let ownerUserId: string;
  let ownerMembershipId: string;

  const permissionId = async (key: PermissionKey): Promise<string> => {
    const permission = await db.query.permissions.findFirst({
      where: { key },
    });
    if (!permission) throw new Error(`Missing permission ${key}`);
    return permission.id;
  };

  const createInternalRole = async (name: string): Promise<string> => {
    const role = await createRole(db, {
      organizationId,
      name,
      isInternal: true,
    });
    return role.id;
  };

  const createMember = async (roleId: string) => {
    const user = await createUser(db);
    const membership = await addMembership(db, user.id, unitId);
    await assignRoleToMembership(db, { membershipId: membership.id, roleId });
    return { userId: user.id, membershipId: membership.id };
  };

  const roleIdsOf = async (membershipId: string): Promise<string[]> => {
    const rows = await db.query.membershipRoles.findMany({
      where: { membershipId },
    });
    return rows.map((row) => row.roleId).sort();
  };

  const membershipExists = async (membershipId: string): Promise<boolean> =>
    !!(await db.query.memberships.findFirst({ where: { id: membershipId } }));

  const removeMembership = (membershipId: string) =>
    graphqlRequest<{ removeMembership?: { id: string } }>(app, {
      query: REMOVE_MEMBERSHIP,
      variables: { id: membershipId },
      headers: { 'x-organization-unit-id': unitId },
    });

  const leaveMembership = (membershipId: string) =>
    graphqlRequest<{ leaveMembership?: { id: string } }>(app, {
      query: LEAVE_MEMBERSHIP,
      variables: { id: membershipId },
    });

  const updateRoles = (membershipId: string, roleIds: string[]) =>
    graphqlRequest<{ updateMembershipRoles?: { id: string } }>(app, {
      query: UPDATE_MEMBERSHIP_ROLES,
      variables: { membershipId, roleIds },
      headers: { 'x-organization-unit-id': unitId },
    });

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;

    const org = await createOrganizationWithType(
      db,
      `Role assignment org ${crypto.randomUUID()}`,
    );
    organizationId = org.organization.id;
    const unit = await createUnit(db, {
      organizationId,
      typeId: org.type.id,
      name: `Role assignment root ${crypto.randomUUID()}`,
    });
    unitId = unit.id;

    ownerRoleId = await createInternalRole(DEFAULT_OWNER_ROLE_NAME);
    for (const key of Object.values(PermissionKey)) {
      await grantPermissionToRole(db, {
        roleId: ownerRoleId,
        permissionId: await permissionId(key),
      });
    }
    memberRoleId = await createInternalRole(DEFAULT_MEMBER_ROLE_NAME);

    const editorRole = await createRole(db, { organizationId });
    for (const key of [
      PermissionKey.VOLUNTEER_VIEW,
      PermissionKey.VOLUNTEER_EDIT,
    ]) {
      await grantPermissionToRole(db, {
        roleId: editorRole.id,
        permissionId: await permissionId(key),
      });
    }
    const helperRole = await createRole(db, { organizationId });
    helperRoleId = helperRole.id;
    await grantPermissionToRole(db, {
      roleId: helperRoleId,
      permissionId: await permissionId(PermissionKey.VOLUNTEER_VIEW),
    });

    const editor = await createMember(editorRole.id);
    editorUserId = editor.userId;
    editorMembershipId = editor.membershipId;
    const owner = await createMember(ownerRoleId);
    ownerUserId = owner.userId;
    ownerMembershipId = owner.membershipId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects a volunteer editor assigning Owner to themselves', async () => {
    setAuthMockUserId(editorUserId);
    const before = await roleIdsOf(editorMembershipId);

    const response = await updateRoles(editorMembershipId, [ownerRoleId]);

    expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
    expect(await roleIdsOf(editorMembershipId)).toEqual(before);
  });

  it('rejects a volunteer editor removing Owner from an owner', async () => {
    // Target is a non-last owner so assertOwnerRemains passes and escalation fails.
    const target = await createMember(ownerRoleId);
    setAuthMockUserId(editorUserId);

    const response = await updateRoles(target.membershipId, [memberRoleId]);

    expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
    expect(await roleIdsOf(target.membershipId)).toEqual([ownerRoleId]);

    // Drop the extra owner so later last-owner tests stay valid.
    setAuthMockUserId(ownerUserId);
    expect(
      (await updateRoles(target.membershipId, [memberRoleId])).errors,
    ).toBeUndefined();
  });

  it('allows a volunteer editor to assign a role within their permissions', async () => {
    setAuthMockUserId(editorUserId);
    const target = await createMember(memberRoleId);

    const response = await updateRoles(target.membershipId, [helperRoleId]);

    expect(response.errors).toBeUndefined();
    expect(await roleIdsOf(target.membershipId)).toEqual([helperRoleId]);
  });

  it('rejects removing Owner from the last owner', async () => {
    setAuthMockUserId(ownerUserId);

    const response = await updateRoles(ownerMembershipId, [memberRoleId]);

    expect(response.errors?.[0]?.message).toMatch(/at least one owner/i);
    expect(await roleIdsOf(ownerMembershipId)).toEqual([ownerRoleId]);
  });

  it('allows an owner to step down when another owner remains', async () => {
    const secondOwner = await createMember(ownerRoleId);
    setAuthMockUserId(secondOwner.userId);

    const response = await updateRoles(secondOwner.membershipId, [
      memberRoleId,
    ]);

    expect(response.errors).toBeUndefined();
    expect(await roleIdsOf(secondOwner.membershipId)).toEqual([memberRoleId]);
  });

  it('still lets a volunteer editor approve membership requests', async () => {
    setAuthMockUserId(editorUserId);
    const applicant = await createUser(db);
    const request = await createMembershipRequest(db, {
      userId: applicant.id,
      organizationUnitId: unitId,
    });

    const response = await graphqlRequest<{
      approveMembershipRequest?: { id: string };
    }>(app, {
      query: APPROVE_MEMBERSHIP_REQUEST,
      variables: { id: request.id, organizationUnitId: unitId },
      headers: { 'x-organization-unit-id': unitId },
    });

    expect(response.errors).toBeUndefined();
    const membership = await db.query.memberships.findFirst({
      where: { userId: applicant.id, organizationUnitId: unitId },
    });
    if (!membership) throw new Error('Approval did not create a membership');
    expect(await roleIdsOf(membership.id)).toEqual([memberRoleId]);
  });

  it('rejects a volunteer editor removing an owner from the org', async () => {
    // Target is a non-last owner so assertOwnerRemains passes and escalation fails.
    const target = await createMember(ownerRoleId);
    setAuthMockUserId(editorUserId);

    const response = await removeMembership(target.membershipId);

    expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
    expect(await membershipExists(target.membershipId)).toBe(true);

    // Drop the extra owner so later last-owner tests stay valid.
    setAuthMockUserId(ownerUserId);
    expect(
      (await updateRoles(target.membershipId, [memberRoleId])).errors,
    ).toBeUndefined();
  });

  it('allows a volunteer editor to remove a member within their permissions', async () => {
    setAuthMockUserId(editorUserId);
    const target = await createMember(helperRoleId);

    const response = await removeMembership(target.membershipId);

    expect(response.errors).toBeUndefined();
    expect(await membershipExists(target.membershipId)).toBe(false);
  });

  it('rejects removing the last owner from the org', async () => {
    setAuthMockUserId(ownerUserId);

    const response = await removeMembership(ownerMembershipId);

    expect(response.errors?.[0]?.message).toMatch(/at least one owner/i);
    expect(await membershipExists(ownerMembershipId)).toBe(true);
  });

  it('rejects the last owner leaving the org', async () => {
    setAuthMockUserId(ownerUserId);

    const response = await leaveMembership(ownerMembershipId);

    expect(response.errors?.[0]?.message).toMatch(/at least one owner/i);
    expect(await membershipExists(ownerMembershipId)).toBe(true);
  });

  it('lets a member leave the org', async () => {
    const member = await createMember(memberRoleId);
    setAuthMockUserId(member.userId);

    const response = await leaveMembership(member.membershipId);

    expect(response.errors).toBeUndefined();
    expect(await membershipExists(member.membershipId)).toBe(false);
  });

  describe('tenant scope of the header unit', () => {
    let childUnitId: string;
    let otherOrgRoleId: string;
    let otherOrgUnitId: string;

    beforeAll(async () => {
      const unitType = await db.query.organizationUnitTypes.findFirst({
        where: { organizationId },
      });
      if (!unitType) throw new Error('Missing unit type');
      const sibling = await createUnit(db, {
        organizationId,
        typeId: unitType.id,
        name: `Role assignment child ${crypto.randomUUID()}`,
        parentId: unitId,
      });
      childUnitId = sibling.id;

      const otherOrg = await createOrganizationWithType(
        db,
        `Role assignment other org ${crypto.randomUUID()}`,
      );
      const otherUnit = await createUnit(db, {
        organizationId: otherOrg.organization.id,
        typeId: otherOrg.type.id,
        name: `Role assignment other root ${crypto.randomUUID()}`,
      });
      otherOrgUnitId = otherUnit.id;
      const otherRole = await createRole(db, {
        organizationId: otherOrg.organization.id,
      });
      otherOrgRoleId = otherRole.id;
    });

    const createMemberIn = async (unit: string, roleId: string) => {
      const user = await createUser(db);
      const membership = await addMembership(db, user.id, unit);
      await assignRoleToMembership(db, {
        membershipId: membership.id,
        roleId,
      });
      return membership.id;
    };

    it('does not update roles of a membership in a child unit', async () => {
      setAuthMockUserId(ownerUserId);
      const membershipId = await createMemberIn(childUnitId, memberRoleId);

      const response = await updateRoles(membershipId, [helperRoleId]);

      expect(response.errors?.[0]?.message).toMatch(/not found/i);
      expect(await roleIdsOf(membershipId)).toEqual([memberRoleId]);
    });

    it('does not update roles of a membership in another organization', async () => {
      setAuthMockUserId(ownerUserId);
      const membershipId = await createMemberIn(otherOrgUnitId, otherOrgRoleId);

      const response = await updateRoles(membershipId, [helperRoleId]);

      expect(response.errors?.[0]?.message).toMatch(/not found/i);
      expect(await roleIdsOf(membershipId)).toEqual([otherOrgRoleId]);
    });

    it('does not remove a membership in a child unit', async () => {
      setAuthMockUserId(ownerUserId);
      const membershipId = await createMemberIn(childUnitId, memberRoleId);

      const response = await removeMembership(membershipId);

      expect(response.errors?.[0]?.message).toMatch(/not found/i);
      expect(await membershipExists(membershipId)).toBe(true);
    });

    it('does not remove a membership in another organization', async () => {
      setAuthMockUserId(ownerUserId);
      const membershipId = await createMemberIn(otherOrgUnitId, otherOrgRoleId);

      const response = await removeMembership(membershipId);

      expect(response.errors?.[0]?.message).toMatch(/not found/i);
      expect(await membershipExists(membershipId)).toBe(true);
      expect(await roleIdsOf(membershipId)).toEqual([otherOrgRoleId]);
    });
  });
});

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
import { PermissionKey } from '../src/auth/enums';
import type { Database } from '../src/database/database.module';
import {
  addMembership,
  createOrganizationWithType,
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

const ROLE = `
  query Role($id: String!) {
    role(id: $id) { id name }
  }
`;

const CREATE_ROLE = `
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) { id }
  }
`;

const UPDATE_ROLE = `
  mutation UpdateRole($id: ID!, $input: CreateRoleInput!) {
    updateRole(id: $id, input: $input) { id name }
  }
`;

const DELETE_ROLE = `
  mutation DeleteRole($id: ID!) {
    deleteRole(id: $id) { id }
  }
`;

describe('role queries and mutations tenant scope', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  /** Caller's org (header B). */
  let orgBId: string;
  let unitBId: string;

  const permissionId = async (key: PermissionKey): Promise<string> => {
    const permission = await db.query.permissions.findFirst({
      where: { key },
    });
    if (!permission) throw new Error(`Missing permission ${key}`);
    return permission.id;
  };

  const createOrgARole = async () => {
    const orgA = await createOrganizationWithType(
      db,
      `Org A ${crypto.randomUUID()}`,
    );
    return createRole(db, {
      organizationId: orgA.organization.id,
      name: `Supervisor ${crypto.randomUUID()}`,
    });
  };

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    orgBId = context.organizationId;
    unitBId = context.organizationUnitId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects updateRole on another org role when header is B', async () => {
    const roleA = await createOrgARole();

    const response = await graphqlRequest<{ updateRole?: { id: string } }>(
      app,
      {
        query: UPDATE_ROLE,
        variables: {
          id: roleA.id,
          input: { name: 'pwned', permissionIds: [] },
        },
        headers: { 'x-organization-unit-id': unitBId },
      },
    );

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    const persistedRole = await db.query.roles.findFirst({
      where: { id: roleA.id },
    });
    expect(persistedRole?.name).toBe(roleA.name);
  });

  it('rejects deleteRole on another org role when header is B', async () => {
    const roleA = await createOrgARole();

    const response = await graphqlRequest<{ deleteRole?: { id: string } }>(
      app,
      {
        query: DELETE_ROLE,
        variables: { id: roleA.id },
        headers: { 'x-organization-unit-id': unitBId },
      },
    );

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    const persistedRole = await db.query.roles.findFirst({
      where: { id: roleA.id },
    });
    expect(persistedRole).toBeTruthy();
  });

  it('rejects role(id) on another org role when header is B', async () => {
    const roleA = await createOrgARole();

    const response = await graphqlRequest<{ role?: { id: string } }>(app, {
      query: ROLE,
      variables: { id: roleA.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    expect(response.data?.role).toBeFalsy();
  });

  it('returns role(id) for a role in the caller org', async () => {
    const roleB = await createRole(db, { organizationId: orgBId });

    const response = await graphqlRequest<{ role?: { id: string } }>(app, {
      query: ROLE,
      variables: { id: roleB.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.role?.id).toBe(roleB.id);
  });

  describe('caller with only org:view and org:edit', () => {
    let limitedUserId: string;
    let editorRoleId: string;

    beforeAll(async () => {
      const user = await createUser(db);
      limitedUserId = user.id;
      const editorRole = await createRole(db, { organizationId: orgBId });
      editorRoleId = editorRole.id;
      await grantPermissionToRole(db, {
        roleId: editorRole.id,
        permissionId: await permissionId(PermissionKey.ORG_VIEW),
      });
      await grantPermissionToRole(db, {
        roleId: editorRole.id,
        permissionId: await permissionId(PermissionKey.ORG_EDIT),
      });
      const membership = await addMembership(db, user.id, unitBId);
      await assignRoleToMembership(db, {
        membershipId: membership.id,
        roleId: editorRole.id,
      });
    });

    it('rejects createRole with a permission the caller lacks', async () => {
      setAuthMockUserId(limitedUserId);

      const response = await graphqlRequest<{ createRole?: { id: string } }>(
        app,
        {
          query: CREATE_ROLE,
          variables: {
            input: {
              name: `escalated ${crypto.randomUUID()}`,
              permissionIds: [
                await permissionId(PermissionKey.ACCOUNTING_MANAGE),
              ],
            },
          },
          headers: { 'x-organization-unit-id': unitBId },
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
      expect(response.data?.createRole).toBeFalsy();
    });

    it('rejects updateRole that escalates the caller own role', async () => {
      setAuthMockUserId(limitedUserId);

      const response = await graphqlRequest<{ updateRole?: { id: string } }>(
        app,
        {
          query: UPDATE_ROLE,
          variables: {
            id: editorRoleId,
            input: {
              name: 'editor',
              permissionIds: [
                await permissionId(PermissionKey.ORG_VIEW),
                await permissionId(PermissionKey.ORG_EDIT),
                await permissionId(PermissionKey.ACCOUNTING_MANAGE),
              ],
            },
          },
          headers: { 'x-organization-unit-id': unitBId },
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
      const grants = await db.query.rolePermissions.findMany({
        where: { roleId: editorRoleId },
      });
      expect(grants).toHaveLength(2);
    });

    it('allows createRole with permissions the caller holds', async () => {
      setAuthMockUserId(limitedUserId);

      const response = await graphqlRequest<{ createRole?: { id: string } }>(
        app,
        {
          query: CREATE_ROLE,
          variables: {
            input: {
              name: `viewer ${crypto.randomUUID()}`,
              permissionIds: [await permissionId(PermissionKey.ORG_VIEW)],
            },
          },
          headers: { 'x-organization-unit-id': unitBId },
        },
      );

      expect(response.errors).toBeUndefined();
      expect(response.data?.createRole?.id).toBeTruthy();
    });

    it('allows renaming a role that holds permissions the caller lacks', async () => {
      setAuthMockUserId(limitedUserId);
      const treasurer = await createRole(db, { organizationId: orgBId });
      const accountingId = await permissionId(PermissionKey.ACCOUNTING_MANAGE);
      await grantPermissionToRole(db, {
        roleId: treasurer.id,
        permissionId: accountingId,
      });
      const newName = `Treasurer ${crypto.randomUUID()}`;

      const response = await graphqlRequest<{
        updateRole?: { id: string; name: string };
      }>(app, {
        query: UPDATE_ROLE,
        variables: {
          id: treasurer.id,
          input: { name: newName, permissionIds: [accountingId] },
        },
        headers: { 'x-organization-unit-id': unitBId },
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.updateRole?.name).toBe(newName);
    });

    it('allows removing a permission the caller lacks from a role', async () => {
      setAuthMockUserId(limitedUserId);
      const treasurer = await createRole(db, { organizationId: orgBId });
      await grantPermissionToRole(db, {
        roleId: treasurer.id,
        permissionId: await permissionId(PermissionKey.ACCOUNTING_MANAGE),
      });

      const response = await graphqlRequest<{ updateRole?: { id: string } }>(
        app,
        {
          query: UPDATE_ROLE,
          variables: {
            id: treasurer.id,
            input: { name: treasurer.name, permissionIds: [] },
          },
          headers: { 'x-organization-unit-id': unitBId },
        },
      );

      expect(response.errors).toBeUndefined();
      const grants = await db.query.rolePermissions.findMany({
        where: { roleId: treasurer.id },
      });
      expect(grants).toHaveLength(0);
    });
  });
});

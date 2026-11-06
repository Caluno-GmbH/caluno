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
import { AuthService } from '../src/auth/auth.service';
import { PERMISSIONS_KEY } from '../src/auth/decorators/permissions.decorator';
import { PermissionKey } from '../src/auth/enums';
import { RoleMutationResolver } from '../src/auth/resolvers/role-mutation.resolver';
import type { Database } from '../src/database/database.module';
import { addMembership, createUnit } from './factories/org.factory';
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

const CREATE_ROLE = `
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) { id name }
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

describe('role:manage permission', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  let organizationId: string;
  let topUnitId: string;
  let childUnitId: string;
  let orgEditorId: string;
  let roleManagerId: string;

  const permissionId = async (key: PermissionKey): Promise<string> => {
    const permission = await db.query.permissions.findFirst({
      where: { key },
    });
    if (!permission) throw new Error(`Missing permission ${key}`);
    return permission.id;
  };

  const createUserWithPermissions = async (
    keys: PermissionKey[],
  ): Promise<string> => {
    const user = await createUser(db);
    const role = await createRole(db, { organizationId });
    for (const key of keys) {
      await grantPermissionToRole(db, {
        roleId: role.id,
        permissionId: await permissionId(key),
      });
    }
    const membership = await addMembership(db, user.id, topUnitId);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
    return user.id;
  };

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    organizationId = context.organizationId;
    topUnitId = context.organizationUnitId;

    const topUnit = await db.query.organizationUnits.findFirst({
      where: { id: topUnitId },
    });
    if (!topUnit) throw new Error('Missing top unit');
    const child = await createUnit(db, {
      organizationId,
      typeId: topUnit.typeId,
      name: `Child ${crypto.randomUUID()}`,
      parentId: topUnitId,
    });
    childUnitId = child.id;

    orgEditorId = await createUserWithPermissions([
      PermissionKey.ORG_VIEW,
      PermissionKey.ORG_EDIT,
    ]);
    roleManagerId = await createUserWithPermissions([
      PermissionKey.ORG_VIEW,
      PermissionKey.ROLE_MANAGE,
      PermissionKey.SHIFT_VIEW,
    ]);
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  const headers = (unitId: string) => ({ 'x-organization-unit-id': unitId });

  // The GraphQL test app switches PermissionGuard off, so a rejection cannot
  // be provoked through a request. Pin what the guard is told to enforce, and
  // check the permission lookup it relies on, instead.
  describe('permission gate', () => {
    for (const mutation of [
      'createRole',
      'updateRole',
      'deleteRole',
    ] as const) {
      it(`requires exactly role:manage for ${mutation}, not org:edit`, () => {
        expect(
          Reflect.getMetadata(
            PERMISSIONS_KEY,
            RoleMutationResolver.prototype[mutation],
          ),
        ).toEqual([PermissionKey.ROLE_MANAGE]);
      });
    }

    it('denies role:manage to a caller with org:edit only', async () => {
      const authService = app.get(AuthService);

      expect(
        await authService.hasRequiredPermissions(orgEditorId, topUnitId, [
          PermissionKey.ORG_EDIT,
        ]),
      ).toBe(true);
      expect(
        await authService.hasRequiredPermissions(orgEditorId, topUnitId, [
          PermissionKey.ROLE_MANAGE,
        ]),
      ).toBe(false);
    });

    it('grants role:manage to a caller holding it', async () => {
      const authService = app.get(AuthService);

      expect(
        await authService.hasRequiredPermissions(roleManagerId, topUnitId, [
          PermissionKey.ROLE_MANAGE,
        ]),
      ).toBe(true);
    });
  });

  describe('caller with role:manage', () => {
    it('can create, update and delete roles within their permissions', async () => {
      setAuthMockUserId(roleManagerId);
      const shiftView = await permissionId(PermissionKey.SHIFT_VIEW);

      const created = await graphqlRequest<{
        createRole?: { id: string; name: string };
      }>(app, {
        query: CREATE_ROLE,
        variables: {
          input: {
            name: `created ${crypto.randomUUID()}`,
            permissionIds: [shiftView],
          },
        },
        headers: headers(topUnitId),
      });
      expect(created.errors).toBeUndefined();
      const roleId = created.data?.createRole?.id;
      expect(roleId).toBeTruthy();

      const newName = `renamed ${crypto.randomUUID()}`;
      const updated = await graphqlRequest<{
        updateRole?: { id: string; name: string };
      }>(app, {
        query: UPDATE_ROLE,
        variables: {
          id: roleId,
          input: { name: newName, permissionIds: [shiftView] },
        },
        headers: headers(topUnitId),
      });
      expect(updated.errors).toBeUndefined();
      expect(updated.data?.updateRole?.name).toBe(newName);

      const deleted = await graphqlRequest<{ deleteRole?: { id: string } }>(
        app,
        {
          query: DELETE_ROLE,
          variables: { id: roleId },
          headers: headers(topUnitId),
        },
      );
      expect(deleted.errors).toBeUndefined();
      const persisted = await db.query.roles.findFirst({
        where: { id: roleId },
      });
      expect(persisted).toBeUndefined();
    });

    it('cannot add a permission they do not hold', async () => {
      setAuthMockUserId(roleManagerId);

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
          headers: headers(topUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
      expect(response.data?.createRole).toBeFalsy();
    });
  });

  describe('removing and deleting within own permissions', () => {
    const createRoleWith = async (keys: PermissionKey[]) => {
      const role = await createRole(db, { organizationId });
      for (const key of keys) {
        await grantPermissionToRole(db, {
          roleId: role.id,
          permissionId: await permissionId(key),
        });
      }
      return role;
    };

    const roleKeys = async (roleId: string): Promise<string[]> => {
      const grants = await db.query.rolePermissions.findMany({
        where: { roleId },
        with: { permission: true },
      });
      return grants.map((g) => g.permission?.key ?? '').sort();
    };

    it('rejects deleting a role holding a permission the caller lacks', async () => {
      setAuthMockUserId(roleManagerId);
      const role = await createRoleWith([
        PermissionKey.SHIFT_VIEW,
        PermissionKey.ACCOUNTING_MANAGE,
      ]);
      const holder = await createUser(db);
      const membership = await addMembership(db, holder.id, topUnitId);
      await assignRoleToMembership(db, {
        membershipId: membership.id,
        roleId: role.id,
      });

      const response = await graphqlRequest<{ deleteRole?: { id: string } }>(
        app,
        {
          query: DELETE_ROLE,
          variables: { id: role.id },
          headers: headers(topUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
      const persisted = await db.query.roles.findFirst({
        where: { id: role.id },
      });
      expect(persisted).toBeTruthy();
      const assignments = await db.query.membershipRoles.findMany({
        where: { roleId: role.id },
      });
      expect(assignments).toHaveLength(1);
    });

    it('allows deleting a role whose permissions the caller all holds', async () => {
      setAuthMockUserId(roleManagerId);
      const role = await createRoleWith([
        PermissionKey.ORG_VIEW,
        PermissionKey.SHIFT_VIEW,
      ]);

      const response = await graphqlRequest<{ deleteRole?: { id: string } }>(
        app,
        {
          query: DELETE_ROLE,
          variables: { id: role.id },
          headers: headers(topUnitId),
        },
      );

      expect(response.errors).toBeUndefined();
      const persisted = await db.query.roles.findFirst({
        where: { id: role.id },
      });
      expect(persisted).toBeUndefined();
    });

    it('rejects removing a permission the caller lacks via updateRole', async () => {
      setAuthMockUserId(roleManagerId);
      const role = await createRoleWith([
        PermissionKey.SHIFT_VIEW,
        PermissionKey.ACCOUNTING_MANAGE,
      ]);

      const response = await graphqlRequest<{ updateRole?: { id: string } }>(
        app,
        {
          query: UPDATE_ROLE,
          variables: {
            id: role.id,
            input: {
              name: role.name,
              permissionIds: [await permissionId(PermissionKey.SHIFT_VIEW)],
            },
          },
          headers: headers(topUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/do not hold/i);
      expect(await roleKeys(role.id)).toEqual(
        [PermissionKey.ACCOUNTING_MANAGE, PermissionKey.SHIFT_VIEW].sort(),
      );
    });

    it('allows removing a permission the caller holds via updateRole', async () => {
      setAuthMockUserId(roleManagerId);
      const role = await createRoleWith([
        PermissionKey.SHIFT_VIEW,
        PermissionKey.ORG_VIEW,
      ]);

      const response = await graphqlRequest<{ updateRole?: { id: string } }>(
        app,
        {
          query: UPDATE_ROLE,
          variables: {
            id: role.id,
            input: {
              name: role.name,
              permissionIds: [await permissionId(PermissionKey.ORG_VIEW)],
            },
          },
          headers: headers(topUnitId),
        },
      );

      expect(response.errors).toBeUndefined();
      expect(await roleKeys(role.id)).toEqual([PermissionKey.ORG_VIEW]);
    });

    it('allows renaming a role without changing its permissions', async () => {
      setAuthMockUserId(roleManagerId);
      const role = await createRoleWith([
        PermissionKey.SHIFT_VIEW,
        PermissionKey.ACCOUNTING_MANAGE,
      ]);
      const newName = `renamed ${crypto.randomUUID()}`;

      const response = await graphqlRequest<{
        updateRole?: { id: string; name: string };
      }>(app, {
        query: UPDATE_ROLE,
        variables: {
          id: role.id,
          input: {
            name: newName,
            permissionIds: [
              await permissionId(PermissionKey.SHIFT_VIEW),
              await permissionId(PermissionKey.ACCOUNTING_MANAGE),
            ],
          },
        },
        headers: headers(topUnitId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.updateRole?.name).toBe(newName);
    });
  });

  describe('top unit only', () => {
    it('rejects createRole with a child unit header', async () => {
      const name = `child ${crypto.randomUUID()}`;

      const response = await graphqlRequest<{ createRole?: { id: string } }>(
        app,
        {
          query: CREATE_ROLE,
          variables: { input: { name, permissionIds: [] } },
          headers: headers(childUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/top unit/i);
      const persisted = await db.query.roles.findFirst({ where: { name } });
      expect(persisted).toBeUndefined();
    });

    it('rejects updateRole with a child unit header', async () => {
      const role = await createRole(db, { organizationId });

      const response = await graphqlRequest<{ updateRole?: { id: string } }>(
        app,
        {
          query: UPDATE_ROLE,
          variables: {
            id: role.id,
            input: {
              name: `renamed ${crypto.randomUUID()}`,
              permissionIds: [],
            },
          },
          headers: headers(childUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/top unit/i);
      const persisted = await db.query.roles.findFirst({
        where: { id: role.id },
      });
      expect(persisted?.name).toBe(role.name);
    });

    it('rejects deleteRole with a child unit header', async () => {
      const role = await createRole(db, { organizationId });

      const response = await graphqlRequest<{ deleteRole?: { id: string } }>(
        app,
        {
          query: DELETE_ROLE,
          variables: { id: role.id },
          headers: headers(childUnitId),
        },
      );

      expect(response.errors?.[0]?.message).toMatch(/top unit/i);
      const persisted = await db.query.roles.findFirst({
        where: { id: role.id },
      });
      expect(persisted).toBeTruthy();
    });
  });

  describe('Owner role', () => {
    it('holds role:manage and can manage roles', async () => {
      const ownerRole = await db.query.roles.findFirst({
        where: { organizationId, name: 'Owner' },
        with: { permissions: { with: { permission: true } } },
      });
      const keys = ownerRole?.permissions.map((rp) => rp.permission?.key);
      expect(keys).toContain(PermissionKey.ROLE_MANAGE);

      const response = await graphqlRequest<{ createRole?: { id: string } }>(
        app,
        {
          query: CREATE_ROLE,
          variables: {
            input: {
              name: `owner-made ${crypto.randomUUID()}`,
              permissionIds: [await permissionId(PermissionKey.ROLE_MANAGE)],
            },
          },
          headers: headers(topUnitId),
        },
      );
      expect(response.errors).toBeUndefined();
      expect(response.data?.createRole?.id).toBeTruthy();
    });
  });
});

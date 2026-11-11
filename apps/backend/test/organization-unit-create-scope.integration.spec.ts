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
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
} from '../src/auth/constants';
import { PermissionKey } from '../src/auth/enums';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
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
import {
  graphqlRequest,
  graphqlRequestRequiringData,
} from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const CREATE_ORGANIZATION_UNIT = `
  mutation CreateOrganizationUnit($input: CreateOrganizationUnitInput!) {
    createOrganizationUnit(input: $input) {
      id
      name
      organizationId
      parent {
        id
      }
    }
  }
`;

describe('createOrganizationUnit tenant scope', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  /** Caller's org (header B). */
  let organizationBId: string;
  let unitBId: string;
  let typeBId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    organizationBId = context.organizationId;
    unitBId = context.organizationUnitId;

    const [type] = await db.query.organizationUnitTypes.findMany({
      where: { organizationId: organizationBId },
      limit: 1,
    });
    if (!type) {
      throw new Error(
        'Expected org B to have a unit type from createOrganization',
      );
    }
    typeBId = type.id;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects createOrganizationUnit into another org when header is B', async () => {
    const orgA = await createOrganizationWithType(
      db,
      `Org A ${crypto.randomUUID()}`,
    );
    // Real orgs always have their internal roles; insert them so a scope
    // rejection cannot fail for the wrong reason (missing role).
    await db.insert(schema.roles).values([
      {
        name: DEFAULT_OWNER_ROLE_NAME,
        description: 'Owner',
        isInternal: true,
        organizationId: orgA.organization.id,
      },
      {
        name: DEFAULT_MEMBER_ROLE_NAME,
        description: 'Member',
        isInternal: true,
        organizationId: orgA.organization.id,
      },
    ]);
    const unitARoot = await createUnit(db, {
      organizationId: orgA.organization.id,
      typeId: orgA.type.id,
      name: `Org A Root ${crypto.randomUUID()}`,
    });

    const response = await graphqlRequest<{
      createOrganizationUnit?: { id: string };
    }>(app, {
      query: CREATE_ORGANIZATION_UNIT,
      variables: {
        input: {
          organizationId: orgA.organization.id,
          parentId: unitARoot.id,
          typeId: orgA.type.id,
          name: 'x',
        },
      },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    expect(response.data?.createOrganizationUnit).toBeFalsy();

    // Shared GraphQL test user accumulates memberships from earlier suite
    // files — assert the security property (no foothold in org A), not an
    // exact global membership list.
    const orgAUnits = await db.query.organizationUnits.findMany({
      where: { organizationId: orgA.organization.id },
      columns: { id: true },
    });
    expect(orgAUnits.map((u) => u.id)).toEqual([unitARoot.id]);

    const attackerMemberships = await db.query.memberships.findMany({
      where: { userId: testUserId },
      columns: { organizationUnitId: true },
    });
    const orgAUnitIds = new Set(orgAUnits.map((u) => u.id));
    expect(
      attackerMemberships.some((m) => orgAUnitIds.has(m.organizationUnitId)),
    ).toBe(false);
  });

  it('creates a child under the header unit using the header org', async () => {
    const name = `Child under B ${crypto.randomUUID()}`;
    const data = await graphqlRequestRequiringData<{
      createOrganizationUnit: {
        id: string;
        name: string;
        organizationId: string;
        parent: { id: string };
      };
    }>(
      app,
      {
        query: CREATE_ORGANIZATION_UNIT,
        variables: {
          input: {
            // Spoofed foreign org id must be ignored in favour of the header.
            organizationId: crypto.randomUUID(),
            parentId: unitBId,
            typeId: typeBId,
            name,
          },
        },
        headers: { 'x-organization-unit-id': unitBId },
      },
      'createOrganizationUnit',
    );

    expect(data.createOrganizationUnit.organizationId).toBe(organizationBId);
    expect(data.createOrganizationUnit.parent.id).toBe(unitBId);
    expect(data.createOrganizationUnit.name).toBe(name);
  });

  it('does not escalate the creator of a sub-org', async () => {
    const authService = app.get(AuthService);
    const user = await createUser(db);
    const editorRole = await createRole(db, {
      organizationId: organizationBId,
    });
    const orgEdit = await db.query.permissions.findFirst({
      where: { key: PermissionKey.ORG_EDIT },
    });
    if (!orgEdit) throw new Error('Missing org:edit permission');
    await grantPermissionToRole(db, {
      roleId: editorRole.id,
      permissionId: orgEdit.id,
    });
    const parentMembership = await addMembership(db, user.id, unitBId);
    await assignRoleToMembership(db, {
      membershipId: parentMembership.id,
      roleId: editorRole.id,
    });

    setAuthMockUserId(user.id);
    const name = `Escalation child ${crypto.randomUUID()}`;
    const data = await graphqlRequestRequiringData<{
      createOrganizationUnit: { id: string };
    }>(
      app,
      {
        query: CREATE_ORGANIZATION_UNIT,
        variables: {
          input: {
            organizationId: organizationBId,
            parentId: unitBId,
            typeId: typeBId,
            name,
          },
        },
        headers: { 'x-organization-unit-id': unitBId },
      },
      'createOrganizationUnit',
    );

    const childId = data.createOrganizationUnit.id;
    const childMembership = await db.query.memberships.findFirst({
      where: { userId: user.id, organizationUnitId: childId },
      with: { roles: { with: { role: true } } },
    });
    expect(childMembership?.roles.map((mr) => mr.role?.name)).toEqual([
      DEFAULT_MEMBER_ROLE_NAME,
    ]);

    const parentKeys = await authService.findUserPermissionKeys(
      user.id,
      unitBId,
    );
    const childKeys = await authService.findUserPermissionKeys(
      user.id,
      childId,
    );
    expect([...childKeys].sort()).toEqual([...parentKeys].sort());
    expect([...childKeys]).toEqual([PermissionKey.ORG_EDIT]);
  });
});

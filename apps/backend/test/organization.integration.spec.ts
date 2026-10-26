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
import { eq } from 'drizzle-orm';
import { PERMISSIONS } from '../src/auth/constants';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { OrganizationService } from '../src/organization/organization.service';
import { createUser } from './factories';
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

describe('OrganizationService.findUnitsWithPermission', () => {
  let app: INestApplication;
  let db: Database;
  let organizationId: string;
  let organizationUnitId: string;
  let testUserId: string;
  let service: OrganizationService;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationId = context.organizationId;
    organizationUnitId = context.organizationUnitId;
    testUserId = context.testUserId;
    service = app.get(OrganizationService);
  });

  // Restore the shared context user so the mock user never leaks into other
  // spec files running in the same process.
  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  const findCheckInPermissionId = async (): Promise<string> => {
    const [permission] = await db
      .select({ id: schema.permissions.id })
      .from(schema.permissions)
      .where(eq(schema.permissions.key, PERMISSIONS.CHECK_IN_MANAGE));
    if (!permission) {
      throw new Error('check-in:manage permission not seeded in test DB');
    }
    return permission.id;
  };

  it('returns the unit for a user whose role grants check-in:manage', async () => {
    const user = await createUser(db);
    setAuthMockUserId(user.id);

    const membership = await addMembership(db, user.id, organizationUnitId);
    const role = await createRole(db, {
      organizationId,
      name: `check-in-manager-${crypto.randomUUID()}`,
    });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: await findCheckInPermissionId(),
    });
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    const units = await service.findUnitsWithPermission(
      user.id,
      PERMISSIONS.CHECK_IN_MANAGE,
    );

    expect(units.map((unit) => unit.id)).toContain(organizationUnitId);
  });

  it('does not return the unit for a user whose role lacks check-in:manage', async () => {
    const user = await createUser(db);
    setAuthMockUserId(user.id);

    const membership = await addMembership(db, user.id, organizationUnitId);
    const role = await createRole(db, {
      organizationId,
      name: `member-${crypto.randomUUID()}`,
    });
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    const units = await service.findUnitsWithPermission(
      user.id,
      PERMISSIONS.CHECK_IN_MANAGE,
    );

    expect(units.map((unit) => unit.id)).not.toContain(organizationUnitId);
  });
});

describe('updateOrganization', () => {
  let app: INestApplication;
  let db: Database;
  let organizationId: string;
  let organizationUnitId: string;
  let testUserId: string;

  const updateOrganizationMutation = `
    mutation UpdateOrganization($id: ID!, $input: UpdateOrganizationInput!) {
      updateOrganization(id: $id, input: $input) {
        id
        contactEmail
      }
    }
  `;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationId = context.organizationId;
    organizationUnitId = context.organizationUnitId;
    testUserId = context.testUserId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects updating another organization when the header is the attacker org root', async () => {
    // Victim org A is the shared context org. Attacker creates org B (and
    // becomes its Owner), then tries to rewrite A's contact email using B as
    // the permission header — the classic IDOR against updateOrganization.
    const createOrgB = await graphqlRequestRequiringData<{
      createOrganization: { id: string; root: { id: string } };
    }>(
      app,
      {
        query: `
          mutation CreateOrganization($input: CreateOrganizationInput!) {
            createOrganization(input: $input) {
              id
              root { id }
            }
          }
        `,
        variables: {
          input: {
            name: `Attacker Org ${crypto.randomUUID()}`,
            contactEmail: `attacker-${crypto.randomUUID()}@example.com`,
          },
        },
      },
      'createOrganization',
    );
    const orgBRootId = createOrgB.createOrganization.root.id;

    const [orgABefore] = await db
      .select({ contactEmail: schema.organizations.contactEmail })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));

    const response = await graphqlRequest<{
      updateOrganization: { id: string; contactEmail: string | null };
    }>(app, {
      query: updateOrganizationMutation,
      variables: {
        id: organizationId,
        input: { contactEmail: 'x@evil' },
      },
      headers: { 'x-organization-unit-id': orgBRootId },
    });

    expect(response.data?.updateOrganization ?? null).toBeNull();
    expect(response.errors?.[0]?.message.toLowerCase()).toContain('not found');

    const [orgAAfter] = await db
      .select({ contactEmail: schema.organizations.contactEmail })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));
    expect(orgAAfter?.contactEmail).toBe(orgABefore?.contactEmail);
  });

  it('updates the organization when the header is that org’s root unit', async () => {
    const email = `safe-${crypto.randomUUID()}@example.com`;

    const data = await graphqlRequestRequiringData<{
      updateOrganization: { id: string; contactEmail: string | null };
    }>(
      app,
      {
        query: updateOrganizationMutation,
        variables: {
          id: organizationId,
          input: { contactEmail: email },
        },
        headers: { 'x-organization-unit-id': organizationUnitId },
      },
      'updateOrganization',
    );

    expect(data.updateOrganization.id).toBe(organizationId);
    expect(data.updateOrganization.contactEmail).toBe(email);
  });

  it('rejects when the header unit is not the organization root', async () => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Child-header Org ${crypto.randomUUID()}`,
    );
    const root = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `root-${crypto.randomUUID()}`,
    });
    const child = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: `child-${crypto.randomUUID()}`,
      parentId: root.id,
    });

    // ORG_EDIT on the child so the permission guard passes; only the root
    // check should reject.
    const membership = await addMembership(db, testUserId, child.id);
    const role = await createRole(db, {
      organizationId: organization.id,
      name: `org-edit-${crypto.randomUUID()}`,
    });
    const orgEditPermission = await db.query.permissions.findFirst({
      where: { key: PERMISSIONS.ORG_EDIT },
    });
    if (!orgEditPermission) {
      throw new Error('ORG_EDIT permission not seeded in test database');
    }
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: orgEditPermission.id,
    });
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    const response = await graphqlRequest<{
      updateOrganization: { id: string };
    }>(app, {
      query: updateOrganizationMutation,
      variables: {
        id: organization.id,
        input: { contactEmail: 'child-header@evil' },
      },
      headers: { 'x-organization-unit-id': child.id },
    });

    expect(response.data?.updateOrganization ?? null).toBeNull();
    expect(response.errors?.[0]?.message.toLowerCase()).toContain('not found');
  });
});

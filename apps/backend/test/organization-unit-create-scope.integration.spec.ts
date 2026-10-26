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
import { DEFAULT_OWNER_ROLE_NAME } from '../src/auth/constants';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
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
    // Real orgs always have an Owner role; without it the attack fails for
    // the wrong reason (addOwnerMembership) and the regression is silent.
    await db.insert(schema.roles).values({
      name: DEFAULT_OWNER_ROLE_NAME,
      description: 'Owner',
      isInternal: true,
      organizationId: orgA.organization.id,
    });
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
});

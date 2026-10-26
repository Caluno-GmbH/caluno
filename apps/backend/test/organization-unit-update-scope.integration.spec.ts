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
import type { Database } from '../src/database/database.module';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const UPDATE_ORGANIZATION_UNIT = `
  mutation UpdateOrganizationUnit(
    $id: String!
    $input: UpdateOrganizationUnitInput!
  ) {
    updateOrganizationUnit(id: $id, input: $input) {
      id
      name
    }
  }
`;

const REQUEST_ORGANIZATION_UNIT_DELETION = `
  mutation RequestOrganizationUnitDeletion($id: String!) {
    requestOrganizationUnitDeletion(id: $id) {
      id
    }
  }
`;

describe('updateOrganizationUnit / requestOrganizationUnitDeletion tenant scope', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;
  /** Caller's org (header B). */
  let unitBId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;
    unitBId = context.organizationUnitId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  it('rejects updateOrganizationUnit on another org when header is B', async () => {
    const orgA = await createOrganizationWithType(
      db,
      `Org A ${crypto.randomUUID()}`,
    );
    const unitARoot = await createUnit(db, {
      organizationId: orgA.organization.id,
      typeId: orgA.type.id,
      name: `Org A Root ${crypto.randomUUID()}`,
    });
    const originalName = unitARoot.name;

    const response = await graphqlRequest<{
      updateOrganizationUnit?: { id: string; name: string };
    }>(app, {
      query: UPDATE_ORGANIZATION_UNIT,
      variables: {
        id: unitARoot.id,
        input: {
          organizationId: orgA.organization.id,
          name: 'pwned',
        },
      },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    expect(response.data?.updateOrganizationUnit).toBeFalsy();

    const still = await db.query.organizationUnits.findFirst({
      where: { id: unitARoot.id },
    });
    expect(still?.name).toBe(originalName);
  });

  it('rejects requestOrganizationUnitDeletion on another org when header is B', async () => {
    const orgA = await createOrganizationWithType(
      db,
      `Org A delete ${crypto.randomUUID()}`,
    );
    const unitARoot = await createUnit(db, {
      organizationId: orgA.organization.id,
      typeId: orgA.type.id,
      name: `Org A Root delete ${crypto.randomUUID()}`,
    });

    const response = await graphqlRequest<{
      requestOrganizationUnitDeletion?: { id: string };
    }>(app, {
      query: REQUEST_ORGANIZATION_UNIT_DELETION,
      variables: { id: unitARoot.id },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors?.[0]?.message).toMatch(/not found/i);
    expect(response.data?.requestOrganizationUnitDeletion).toBeFalsy();
  });
});

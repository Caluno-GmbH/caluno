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
      idVerificationEnabled
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
  let orgBId: string;
  let unitBId: string;

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

  it('updates idVerificationEnabled without requiring name', async () => {
    const before = await db.query.organizationUnits.findFirst({
      where: { id: unitBId },
    });
    expect(before).toBeTruthy();
    const originalName = before?.name;
    const nextEnabled = !before?.idVerificationEnabled;

    const response = await graphqlRequest<{
      updateOrganizationUnit?: {
        id: string;
        name: string;
        idVerificationEnabled: boolean;
      };
    }>(app, {
      query: UPDATE_ORGANIZATION_UNIT,
      variables: {
        id: unitBId,
        input: {
          organizationId: orgBId,
          idVerificationEnabled: nextEnabled,
        },
      },
      headers: { 'x-organization-unit-id': unitBId },
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.updateOrganizationUnit).toEqual({
      id: unitBId,
      name: originalName,
      idVerificationEnabled: nextEnabled,
    });

    const after = await db.query.organizationUnits.findFirst({
      where: { id: unitBId },
    });
    expect(after?.name).toBe(originalName);
    expect(after?.idVerificationEnabled).toBe(nextEnabled);
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

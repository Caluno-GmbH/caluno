import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Database } from '../src/database/database.module';
import { createUser } from './factories';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { applyBunAuthMocks } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const MEMBERSHIPS_WITH_PROFILE = `
  query Memberships {
    memberships {
      id
      user { id preferredName birthdate gender phone street zip city }
    }
  }
`;

describe('memberships user profile fields', () => {
  let app: INestApplication;
  let db: Database;
  let unitId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;

    const org = await createOrganizationWithType(
      db,
      `MembershipsProfile ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Profile query unit',
    });
    unitId = unit.id;

    // Add the test caller as a member so the query returns at least one row
    const { testUserId } = context;
    await addMembership(db, testUserId, unitId);
  });

  it('can query profile fields on memberships.user without GraphQL validation errors', async () => {
    const data = await graphqlRequestRequiringData<{
      memberships: Array<{
        id: string;
        user: { id: string; city: string | null; birthdate: string | null };
      }>;
    }>(
      app,
      {
        query: MEMBERSHIPS_WITH_PROFILE,
        headers: { 'x-organization-unit-id': unitId },
      },
      'memberships',
    );

    expect(Array.isArray(data.memberships)).toBe(true);
    expect(data.memberships.length).toBeGreaterThan(0);
  });

  it('returns profile field values for a member with known profile data', async () => {
    const volunteer = await createUser(db, {
      city: 'Hamburg',
      birthdate: '1990-08-02',
    });
    await addMembership(db, volunteer.id, unitId);

    const data = await graphqlRequestRequiringData<{
      memberships: Array<{
        id: string;
        user: {
          id: string;
          city: string | null;
          birthdate: string | null;
        };
      }>;
    }>(
      app,
      {
        query: MEMBERSHIPS_WITH_PROFILE,
        headers: { 'x-organization-unit-id': unitId },
      },
      'memberships',
    );

    const volunteerMembership = data.memberships.find(
      (m) => m.user.id === volunteer.id,
    );
    expect(volunteerMembership).toBeDefined();
    expect(volunteerMembership?.user.city).toBe('Hamburg');
    expect(volunteerMembership?.user.birthdate).toBe('1990-08-02');
  });

  it('payment fields (iban, bic, accountHolder) are NOT exposed on the memberships path', async () => {
    const assertPaymentFieldRejected = async (field: string): Promise<void> => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('x-organization-unit-id', unitId)
        .send({ query: `{ memberships { user { ${field} } } }` });

      const body = res.body as {
        errors?: Array<{ message: string }>;
      };
      expect(body.errors).toBeDefined();
      expect(
        body.errors?.some(
          (e) =>
            e.message.includes('Cannot query field') &&
            e.message.includes(field),
        ),
      ).toBe(true);
    };

    await assertPaymentFieldRejected('iban');
    await assertPaymentFieldRejected('bic');
    await assertPaymentFieldRejected('accountHolder');
  });
});

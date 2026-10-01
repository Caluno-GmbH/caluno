import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/database/database.module';
import { createUser } from './factories';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import {
  graphqlRequest,
  graphqlRequestRequiringData,
} from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('updateMyProfile name fields', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
  });

  it('trims firstname/lastname and syncs name', async () => {
    const user = await createUser(db, {
      firstname: 'Old',
      lastname: 'Name',
    });
    setAuthMockUserId(user.id);

    const data = await graphqlRequestRequiringData<{
      updateMyProfile: {
        id: string;
        firstname: string;
        lastname: string;
        name: string;
      };
    }>(
      app,
      {
        query: `
          mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
            updateMyProfile(input: $input) {
              id
              firstname
              lastname
              name
            }
          }
        `,
        variables: {
          input: {
            firstname: '  Ada ',
            lastname: ' Lovelace ',
          },
        },
      },
      'updateMyProfile',
    );

    expect(data.updateMyProfile).toMatchObject({
      firstname: 'Ada',
      lastname: 'Lovelace',
      name: 'Ada Lovelace',
    });
  });

  it('rejects blank firstname', async () => {
    const user = await createUser(db);
    setAuthMockUserId(user.id);

    const response = await graphqlRequest<{
      updateMyProfile?: { id: string } | null;
    }>(app, {
      query: `
          mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
            updateMyProfile(input: $input) {
              id
            }
          }
        `,
      variables: {
        input: {
          firstname: '   ',
          lastname: 'Lovelace',
        },
      },
    });

    expect(response.errors?.[0]?.message).toMatch(/First and last name/i);
  });
});

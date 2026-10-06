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
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { createUser } from './factories';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { createGraphqlFullTestApp } from './helpers/create-graphql-full-app';
import { graphqlRequest } from './helpers/graphql-request';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('terms acceptance guard', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    app = await createGraphqlFullTestApp();
    db = app.get(DATABASE_CONNECTION);
  });

  it('rejects a pending user and allows termsStatus', async () => {
    const user = await createUser(db, { termsVersion: null });
    setAuthMockUserId(user.id);

    const pending = await graphqlRequest(app, { query: '{ me { id } }' });
    expect(pending.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const status = await graphqlRequest<{
      termsStatus: { mustAccept: boolean; currentVersion: string | null };
    }>(app, {
      query: '{ termsStatus { mustAccept currentVersion } }',
    });
    expect(status.errors).toBeUndefined();
    expect(status.data?.termsStatus.mustAccept).toBe(true);
  });
});

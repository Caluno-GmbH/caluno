import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { TermsService } from '../src/terms/services/terms.service';
import { createUser } from './factories';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

const SEEDED_TERMS_VERSION = '1.0';

describe('terms acceptance guard', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    await app.get(TermsService).publishVersion(SEEDED_TERMS_VERSION);
  });

  afterAll(async () => {
    await db
      .delete(schema.termsVersions)
      .where(eq(schema.termsVersions.version, SEEDED_TERMS_VERSION));
    setAuthMockUserId('test-user-id');
  });

  it('rejects a pending user on normal operations but allows termsStatus', async () => {
    const user = await createUser(db, { termsVersion: null });
    setAuthMockUserId(user.id, null);

    const pending = await graphqlRequest(app, { query: '{ me { id } }' });
    expect(pending.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const status = await graphqlRequest<{
      termsStatus: { mustAccept: boolean; currentVersion: string | null };
    }>(app, {
      query: '{ termsStatus { mustAccept currentVersion } }',
    });
    expect(status.errors).toBeUndefined();
    expect(status.data?.termsStatus.mustAccept).toBe(true);
    expect(status.data?.termsStatus.currentVersion).toBe(SEEDED_TERMS_VERSION);
  });

  it('leaves the escape-hatched acceptTerms mutation reachable for a pending user', async () => {
    const user = await createUser(db, { termsVersion: null });
    setAuthMockUserId(user.id, null);

    const response = await graphqlRequest(app, {
      query: `
        mutation AcceptTerms($input: AcceptTermsInput!) {
          acceptTerms(input: $input) { mustAccept }
        }
      `,
      variables: {
        input: { version: SEEDED_TERMS_VERSION, language: 'de' },
      },
    });

    expect(response.errors?.[0]?.extensions?.code).not.toBe('FORBIDDEN');
  });

  it('leaves the escape-hatched unsubscribeFromEmails mutation reachable for a pending user', async () => {
    const user = await createUser(db, { termsVersion: null });
    setAuthMockUserId(user.id, null);

    const response = await graphqlRequest<{
      unsubscribeFromEmails: boolean;
    }>(app, {
      query: 'mutation { unsubscribeFromEmails }',
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.unsubscribeFromEmails).toBe(true);

    const [updated] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id));
    expect(updated?.emailWeeklyUpdateEnabled).toBe(false);
    expect(updated?.emailUrgentCallsEnabled).toBe(false);
    expect(updated?.emailPlatformEnabled).toBe(false);
  });
});

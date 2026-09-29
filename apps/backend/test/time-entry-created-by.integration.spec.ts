import 'reflect-metadata';
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
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { createUser } from './factories';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('TimeEntry createdBy (who recorded it)', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;
  let testUserId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitId = context.organizationUnitId;
    testUserId = context.testUserId;
  });

  afterAll(() => {
    setAuthMockUserId(testUserId);
  });

  const headers = () => ({ 'x-organization-unit-id': organizationUnitId });

  it('records the acting user as createdBy on addTimeEntry', async () => {
    const admin = await createUser(db);
    const volunteer = await createUser(db);
    setAuthMockUserId(admin.id);

    const data = await graphqlRequestRequiringData<{
      addTimeEntry: { id: string; createdBy: { id: string } | null };
    }>(
      app,
      {
        query: `
          mutation Add($input: AddTimeEntryInput!) {
            addTimeEntry(input: $input) {
              id
              createdBy { id }
            }
          }
        `,
        variables: {
          input: {
            volunteerId: volunteer.id,
            startedAt: new Date().toISOString(),
          },
        },
        headers: headers(),
      },
      'addTimeEntry',
    );

    expect(data.addTimeEntry.createdBy?.id).toBe(admin.id);
  });

  it('does not change createdBy on updateTimeEntry', async () => {
    const admin = await createUser(db);
    const volunteer = await createUser(db);
    setAuthMockUserId(admin.id);

    const created = await graphqlRequestRequiringData<{
      addTimeEntry: { id: string };
    }>(
      app,
      {
        query: `
          mutation Add($input: AddTimeEntryInput!) {
            addTimeEntry(input: $input) { id }
          }
        `,
        variables: {
          input: {
            volunteerId: volunteer.id,
            startedAt: new Date().toISOString(),
          },
        },
        headers: headers(),
      },
      'addTimeEntry',
    );

    const editor = await createUser(db);
    setAuthMockUserId(editor.id);

    const updated = await graphqlRequestRequiringData<{
      updateTimeEntry: {
        id: string;
        createdBy: { id: string } | null;
        notes: string | null;
      };
    }>(
      app,
      {
        query: `
          mutation Update($id: ID!, $input: UpdateTimeEntryInput!) {
            updateTimeEntry(id: $id, input: $input) {
              id
              createdBy { id }
              notes
            }
          }
        `,
        variables: {
          id: created.addTimeEntry.id,
          input: {
            startedAt: new Date().toISOString(),
            notes: 'edited',
          },
        },
        headers: headers(),
      },
      'updateTimeEntry',
    );

    expect(updated.updateTimeEntry.createdBy?.id).toBe(admin.id);
    expect(updated.updateTimeEntry.notes).toBe('edited');
  });

  it('returns null createdBy for entries without a recorder', async () => {
    const volunteer = await createUser(db);
    const [entry] = await db
      .insert(schema.timeEntries)
      .values({
        organizationUnitId,
        volunteerId: volunteer.id,
        startedAt: new Date(),
      })
      .returning();

    const data = await graphqlRequestRequiringData<{
      timeEntry: { createdBy: { id: string } | null };
    }>(
      app,
      {
        query: `
          query Entry($id: String!) {
            timeEntry(id: $id) { createdBy { id } }
          }
        `,
        variables: { id: entry.id },
        headers: headers(),
      },
      'timeEntry',
    );

    expect(data.timeEntry.createdBy).toBeNull();
  });
});

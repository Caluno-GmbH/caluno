import type { Database } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  formatUserName,
  resolveNamesForBackfill,
} from '../../src/user/user-name';

export type User = typeof schema.users.$inferSelect;

export const createUser = async (
  db: Database,
  overrides?: Partial<typeof schema.users.$inferInsert>,
): Promise<User> => {
  const suffix = crypto.randomUUID();
  const id = overrides?.id ?? `test-user-${suffix}`;
  const displayName = overrides?.name ?? `Test User ${suffix}`;
  const names = resolveNamesForBackfill({
    name: displayName,
    firstname: overrides?.firstname,
    lastname: overrides?.lastname,
  });

  const firstname =
    overrides?.firstname !== undefined && overrides.firstname !== null
      ? String(overrides.firstname).trim()
      : names.firstname;
  const lastname =
    overrides?.lastname !== undefined && overrides.lastname !== null
      ? String(overrides.lastname).trim()
      : names.lastname;

  const [user] = await db
    .insert(schema.users)
    .values({
      id,
      email: `test-user-${suffix}@example.com`,
      ...overrides,
      firstname,
      lastname,
      name: formatUserName(firstname, lastname),
    })
    .returning();

  if (!user) {
    throw new Error('Failed to create test user');
  }

  return user;
};

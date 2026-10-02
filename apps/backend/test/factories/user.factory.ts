import type { Database } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { formatUserName } from '../../src/user/user-name';
import { trimmed } from '../../src/utils';

export type User = typeof schema.users.$inferSelect;

export const createUser = async (
  db: Database,
  overrides?: Partial<typeof schema.users.$inferInsert>,
): Promise<User> => {
  const suffix = crypto.randomUUID();
  const id = overrides?.id ?? `test-user-${suffix}`;
  const firstname = trimmed(overrides?.firstname) ?? `Test`;
  const lastname = trimmed(overrides?.lastname) ?? `User ${suffix}`;
  const name = formatUserName(firstname, lastname);

  const [user] = await db
    .insert(schema.users)
    .values({
      id,
      email: `test-user-${suffix}@example.com`,
      ...overrides,
      firstname,
      lastname,
      name,
    })
    .returning();

  if (!user) {
    throw new Error('Failed to create test user');
  }

  return user;
};

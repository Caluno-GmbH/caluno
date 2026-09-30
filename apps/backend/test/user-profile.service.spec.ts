import 'reflect-metadata';
import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import { UserProfileService } from '../src/requirement-profile/services/user-profile.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { createUser } from './factories';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

describe('UserProfileService.findByUserId', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let userProfileService: UserProfileService;

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    userProfileService = new UserProfileService(db, {
      capture: () => {},
    } as unknown as PostHogService);

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
  });

  it('merges users.email into profile data, overwriting a stale copy', async () => {
    const email = `profile-email-${crypto.randomUUID()}@example.com`;
    const user = await createUser(db, { email });
    await db.insert(schema.userProfiles).values({
      userId: user.id,
      data: {
        firstName: 'Ada',
        email: 'stale@example.com',
      },
    });

    const result = await userProfileService.findByUserId(user.id);

    expect(result?.data).toEqual({
      firstName: 'Ada',
      email,
    });
  });

  it('returns undefined when no profile exists', async () => {
    const user = await createUser(db);
    expect(await userProfileService.findByUserId(user.id)).toBeUndefined();
  });
});

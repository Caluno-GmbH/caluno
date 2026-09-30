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

  it('returns a profile with email when no profile existed before', async () => {
    const user = await createUser(db);
    const result = await userProfileService.findByUserId(user.id);
    expect(result).not.toBeUndefined();
    expect(result?.data).toEqual({
      email: user.email,
    });
  });
});

describe('UserProfileService.ensureEmpty', () => {
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

  it('creates an empty profile when missing', async () => {
    const suffix = crypto.randomUUID();
    const [user] = await db
      .insert(schema.users)
      .values({
        id: `ensure-empty-${suffix}`,
        name: `Ensure Empty ${suffix}`,
        email: `ensure-empty-${suffix}@example.com`,
      })
      .returning();

    await userProfileService.ensureEmptyProfile(user.id);
    const profile = await db.query.userProfiles.findFirst({
      where: { userId: user.id },
    });

    expect(profile?.userId).toBe(user.id);
    expect(profile?.data).toEqual({});
  });

  it('is idempotent when a profile already exists', async () => {
    const user = await createUser(db);
    const data = { lastName: 'Kept' };
    await db
      .insert(schema.userProfiles)
      .values({ userId: user.id, data: data });

    await userProfileService.ensureEmptyProfile(user.id);
    const profile = await db.query.userProfiles.findFirst({
      where: { userId: user.id },
    });

    expect(profile?.data).toEqual(data);
  });
});

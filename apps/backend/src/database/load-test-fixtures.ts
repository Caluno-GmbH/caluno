/**
 * Load-test dataset for `packages/load-test` (k6).
 *
 * Creates the organizations planned in `load-test-plan.ts`: three units each,
 * with volunteers and one coordinator (unit owner), weekly recurring shifts
 * with history, events, past time entries, a "call-out" shift for tomorrow
 * (spike scenario) and an all-day check-in desk shift for today (kiosk
 * scenario).
 *
 * Every account gets a database session whose token is derived from
 * BETTER_AUTH_SECRET, so `bun run load-test:data` can produce the matching
 * cookies anywhere without database access, and k6 never goes through the
 * sign-in endpoint (Better Auth allows 3 sign-ins per 10 s per IP).
 *
 * Usage (from apps/backend, after migrate + `bun run db:seed`):
 *
 *   bun run db:fixtures:load-test
 *
 * The load-test backend runs it on boot (docker-entrypoint.sh). Re-runs are
 * idempotent, re-anchor the call-out and check-in shifts to tomorrow/today and
 * extend the sessions. Never run against production.
 */
import { hashPassword } from 'better-auth/crypto';
import { inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { PERMISSIONS } from '../auth/constants';
import { ShiftVisibility } from '../shift/enums';
import { compareVersions } from '../terms/terms-files';
import { TimeEntryClosureKind } from '../time-tracking/enums/time-entry-closure-kind.enum';
import { ensureDemoOrganization } from './demo-organization';
import {
  addDaysInFixtureTimezone,
  addHours,
  assertFixtureIdentitiesAvailable,
  createAuthUser,
  type Database,
  ensureAnchoredOneTimeShiftWithInvites,
  ensureEvent,
  ensureMembershipWithRole,
  ensureShiftWithInvites,
  type FixtureUser,
  findWeekdayWeeksAgo,
  fixtureOrgId,
  fixtureWallClockToUtc,
  getDateInFixtureTimezone,
  type PlannedFixtureAccount,
} from './fixture-helpers';
import {
  LOAD_TEST_REGIONS,
  loadTestCheckInId,
  loadTestSessionToken,
  planLoadTestOrganizations,
} from './load-test-plan';
import { relations } from './relations';
import * as schema from './schema';

process.env.TZ = 'Europe/Berlin';

const PASSWORD = process.env.LOAD_TEST_PASSWORD ?? 'abcd1234';
const SESSION_DAYS = 30;
const JOINED_PER_INSTANCE = 5;

const WEEKLY_SHIFTS = [
  { title: 'Morning Support', weekday: 1, hour: 9, rrule: 'BYDAY=MO' },
  { title: 'Food Distribution', weekday: 2, hour: 12, rrule: 'BYDAY=TU' },
  { title: 'Reading Hour', weekday: 3, hour: 15, rrule: 'BYDAY=WE' },
  { title: 'Senior Visits', weekday: 4, hour: 10, rrule: 'BYDAY=TH' },
  { title: 'Evening Help Desk', weekday: 5, hour: 17, rrule: 'BYDAY=FR' },
  { title: 'Weekend Clean-up', weekday: 6, hour: 10, rrule: 'BYDAY=SA' },
] as const;

const pick = <T>(items: readonly T[], count: number, offset: number): T[] =>
  Array.from(
    { length: Math.min(count, items.length) },
    (_, index) => items[(offset + index) % items.length] as T,
  );

const createUsers = async (
  db: Database,
  hashedPassword: string,
  accounts: PlannedFixtureAccount[],
): Promise<FixtureUser[]> => {
  const users: FixtureUser[] = [];
  for (const account of accounts) {
    users.push(
      await createAuthUser(db, hashedPassword, { ...account, locale: 'de' }),
    );
  }
  return users;
};

const acceptCurrentTerms = async (db: Database, userIds: string[]) => {
  const published = await db
    .select({ version: schema.termsVersions.version })
    .from(schema.termsVersions);
  const current = published
    .map((row) => row.version)
    .sort(compareVersions)
    .at(-1);
  if (!current) {
    return;
  }
  for (let start = 0; start < userIds.length; start += 1000) {
    await db
      .update(schema.users)
      .set({ termsVersion: current })
      .where(inArray(schema.users.id, userIds.slice(start, start + 1000)));
  }
};

/** Upserts each account's derived session and pins its check-in code. */
const ensureSessions = async (
  db: Database,
  userIds: string[],
  secret: string,
) => {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  for (let start = 0; start < userIds.length; start += 1000) {
    const batch = userIds.slice(start, start + 1000);
    await db
      .insert(schema.sessions)
      .values(
        batch.map((userId) => ({
          id: crypto.randomUUID(),
          token: loadTestSessionToken(secret, userId),
          userId,
          expiresAt,
          userAgent: 'k6-load-test',
        })),
      )
      .onConflictDoUpdate({
        target: schema.sessions.token,
        set: { expiresAt },
      });
    await db
      .update(schema.users)
      .set({
        checkInId: sql`case ${schema.users.id} ${sql.join(
          batch.map(
            (userId) => sql`when ${userId} then ${loadTestCheckInId(userId)}`,
          ),
          sql` `,
        )} end`,
      })
      .where(inArray(schema.users.id, batch));
  }
};

const seedPastTimeEntries = async (
  db: Database,
  organizationUnitId: string,
  coordinatorId: string,
  volunteerIds: string[],
) => {
  const existing = await db.query.timeEntries.findFirst({
    where: { organizationUnitId },
  });
  if (existing) {
    return;
  }
  const today = getDateInFixtureTimezone(new Date());
  const entries = volunteerIds.flatMap((volunteerId, index) =>
    [7, 14, 21].map((daysAgo) => {
      const day = addDaysInFixtureTimezone(
        today.year,
        today.month,
        today.day,
        -(daysAgo + (index % 5)),
      );
      const startedAt = fixtureWallClockToUtc(day.year, day.month, day.day, 10);
      return {
        organizationUnitId,
        volunteerId,
        createdById: coordinatorId,
        startedAt,
        endedAt: addHours(startedAt, 2),
        closureKind: TimeEntryClosureKind.MANUAL,
        notes: 'Load test history',
      };
    }),
  );
  await db.insert(schema.timeEntries).values(entries);
};

async function seedLoadTestFixtures() {
  if (process.env.APP_ENV === 'production') {
    throw new Error('Refusing to seed load-test fixtures into production.');
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET is required to derive the load-test sessions.',
    );
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });
  const db = drizzle({ client: pool, relations });

  const plans = planLoadTestOrganizations();
  const hashedPassword = await hashPassword(PASSWORD);

  for (const plan of plans) {
    await assertFixtureIdentitiesAvailable(db, {
      orgSlug: plan.slug,
      unitSlugs: [plan.slug, ...plan.units.map((unit) => unit.slug)],
      accounts: [
        plan.owner,
        ...plan.units.flatMap((unit) => [unit.coordinator, ...unit.volunteers]),
      ],
    });
  }

  const today = getDateInFixtureTimezone(new Date());
  const tomorrow = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    1,
  );
  const sessionUserIds: string[] = [];

  for (const [orgIndex, plan] of plans.entries()) {
    const [owner] = await createUsers(db, hashedPassword, [plan.owner]);
    if (!owner) {
      throw new Error(`Failed to create owner for ${plan.slug}`);
    }

    const org = await ensureDemoOrganization(db, owner.id, {
      orgId: fixtureOrgId(plan.slug),
      orgSlug: plan.slug,
      orgName: plan.name,
      orgDescription: 'Synthetic organization for load testing.',
      contactEmail: plan.owner.email,
      rootCoverImageUrl: null,
      northCoverImageUrl: null,
      supervisorRoleName: 'Supervisor',
      supervisorPermissions: [
        PERMISSIONS.ORG_VIEW,
        PERMISSIONS.SHIFT_VIEW,
        PERMISSIONS.SHIFT_EDIT,
        PERMISSIONS.VOLUNTEER_VIEW,
        PERMISSIONS.CHECK_IN_MANAGE,
      ],
      regions: plan.units.map((unit) => ({
        key: unit.key,
        name: `${plan.name} ${LOAD_TEST_REGIONS.find((region) => region.key === unit.key)?.name}`,
        slug: unit.slug,
        description: 'Synthetic unit for load testing.',
      })),
    });

    for (const unit of plan.units) {
      const unitId = org.unitIds[unit.key];
      const [coordinator] = await createUsers(db, hashedPassword, [
        unit.coordinator,
      ]);
      if (!coordinator) {
        throw new Error(`Failed to create coordinator for ${unit.slug}`);
      }
      await ensureMembershipWithRole(
        db,
        coordinator.id,
        unitId,
        org.ownerRoleId,
      );

      const volunteers = await createUsers(db, hashedPassword, unit.volunteers);
      for (const volunteer of volunteers) {
        await ensureMembershipWithRole(
          db,
          volunteer.id,
          unitId,
          org.memberRoleId,
        );
      }
      const volunteerIds = volunteers.map((volunteer) => volunteer.id);

      for (const [shiftIndex, shift] of WEEKLY_SHIFTS.entries()) {
        const start = findWeekdayWeeksAgo(shift.weekday, 8);
        await ensureShiftWithInvites(db, unitId, coordinator.id, {
          title: shift.title,
          startsAt: fixtureWallClockToUtc(
            start.year,
            start.month,
            start.day,
            shift.hour,
          ),
          rrule: `FREQ=WEEKLY;${shift.rrule};WKST=MO`,
          visibility: ShiftVisibility.ALL_MEMBERS,
          maxVolunteers: 8,
          minVolunteers: 4,
          location: `${unit.slug} community center`,
          inviteUserIds: pick(
            volunteerIds,
            JOINED_PER_INSTANCE,
            shiftIndex * JOINED_PER_INSTANCE,
          ),
        });
      }

      for (const [eventIndex, title] of [
        'Summer Festival',
        'Charity Run',
      ].entries()) {
        const day = addDaysInFixtureTimezone(
          today.year,
          today.month,
          today.day,
          10 + eventIndex * 14,
        );
        const startsAt = fixtureWallClockToUtc(day.year, day.month, day.day, 9);
        const event = await ensureEvent(db, unitId, coordinator.id, {
          title,
          startsAt,
          endsAt: addHours(startsAt, 9),
        });
        await ensureShiftWithInvites(db, unitId, coordinator.id, {
          title: `${title} Setup`,
          startsAt,
          rrule: 'FREQ=DAILY;COUNT=1',
          eventId: event.id,
          visibility: ShiftVisibility.ALL_MEMBERS,
          maxVolunteers: 15,
          inviteUserIds: pick(volunteerIds, 3, eventIndex * 3),
        });
      }

      await ensureAnchoredOneTimeShiftWithInvites(db, unitId, coordinator.id, {
        title: 'Check-in Desk',
        startsAt: fixtureWallClockToUtc(today.year, today.month, today.day, 6),
        durationMinutes: 16 * 60,
        rrule: 'FREQ=DAILY;COUNT=1',
        visibility: ShiftVisibility.ALL_MEMBERS,
        inviteUserIds: [],
      });

      if (unit.key === 'nord') {
        await ensureAnchoredOneTimeShiftWithInvites(
          db,
          unitId,
          coordinator.id,
          {
            title: 'Urgent Call-out',
            startsAt: fixtureWallClockToUtc(
              tomorrow.year,
              tomorrow.month,
              tomorrow.day,
              10,
            ),
            rrule: 'FREQ=DAILY;COUNT=1',
            visibility: ShiftVisibility.ALL_MEMBERS,
            maxVolunteers: 10,
            minVolunteers: 6,
            inviteUserIds: [],
          },
        );
      }

      await seedPastTimeEntries(db, unitId, coordinator.id, volunteerIds);

      sessionUserIds.push(coordinator.id, ...volunteerIds);
    }

    console.log(`Seeded ${plan.slug} (${orgIndex + 1}/${plans.length})`);
  }

  await acceptCurrentTerms(db, sessionUserIds);
  await ensureSessions(db, sessionUserIds, secret);

  console.log(
    `Load-test fixtures: ${plans.length} orgs, ${sessionUserIds.length} accounts with sessions valid for ${SESSION_DAYS} days.`,
  );

  await pool.end();
}

seedLoadTestFixtures().catch((error) => {
  console.error(error);
  process.exit(1);
});

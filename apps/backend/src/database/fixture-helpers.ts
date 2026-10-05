/**
 * Shared helpers for Playground (`fixtures.ts`) and demo (`demo-fixtures.ts`)
 * seed scripts. Keep this module free of top-level side effects — both scripts
 * run seed on import.
 */
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ShiftInviteStatus, ShiftVisibility } from '../shift/enums';
import { expandShift } from '../shift/utils/rrule-expander';
import { formatUserName } from '../user/user-name';
import { slugify } from '../utils/slug.util';
import { relations } from './relations';
import * as schema from './schema';

export const FIXTURE_TIMEZONE = 'Europe/Berlin';
export const DEFAULT_SHIFT_DURATION_MINUTES = 240;

export type Database = NodePgDatabase<typeof relations>;

export type FixtureUser = {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
};

export type FixtureDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

export type ShiftFixture = {
  /** Defaults to a random UUID. */
  id?: string;
  title: string;
  startsAt: Date;
  rrule: string;
  inviteUserIds: string[];
  /** Defaults to `DEFAULT_SHIFT_DURATION_MINUTES`. */
  durationMinutes?: number;
  /** Associates the shift with an event. */
  eventId?: string;
  /** Defaults to `ShiftVisibility.INVITED_MEMBERS`. */
  visibility?: ShiftVisibility;
  /** Capacity cap; omit for unlimited spots. */
  maxVolunteers?: number;
  instructions?: string;
  location?: string;
  imageUrl?: string;
  joinRequiresApproval?: boolean;
  reimbursementTypeId?: string;
  /** Invites inserted with this status instead of JOINED (does not count toward capacity). */
  pendingInviteUserIds?: string[];
  /**
   * Invites at explicit statuses (e.g. VOLUNTEER_REJECTED, VOLUNTEER_CANCELLED,
   * WAITLIST_JOINED), seeded to every instance. Only JOINED counts toward capacity.
   */
  extraInvites?: Array<{ userIds: string[]; status: ShiftInviteStatus }>;
};

export type FixtureEventInput = {
  /** When set, idempotency looks up by id (Playground e2e stable IDs). */
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  startsAt: Date;
  endsAt: Date;
};

export const getDateInFixtureTimezone = (instant: Date): FixtureDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FIXTURE_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(instant);

  const read = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    weekday: weekdayMap[read('weekday')] ?? 0,
  };
};

export const fixtureWallClockToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FIXTURE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const baseUtc = Date.UTC(year, month - 1, day, hour, minute);

  for (let offsetHours = -3; offsetHours <= 3; offsetHours += 0.25) {
    const candidate = new Date(baseUtc - offsetHours * 3_600_000);
    const formatted = formatter.formatToParts(candidate);
    const read = (type: string): number =>
      Number(formatted.find((part) => part.type === type)?.value);

    if (
      read('year') === year &&
      read('month') === month &&
      read('day') === day &&
      read('hour') === hour &&
      read('minute') === minute
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Could not resolve ${year}-${month}-${day} ${hour}:${minute} in ${FIXTURE_TIMEZONE}`,
  );
};

export const addDaysInFixtureTimezone = (
  year: number,
  month: number,
  day: number,
  days: number,
): Omit<FixtureDateParts, 'weekday'> => {
  const noonUtc = fixtureWallClockToUtc(year, month, day, 12);
  return getDateInFixtureTimezone(
    new Date(noonUtc.getTime() + days * 86_400_000),
  );
};

export const findWeekdayWeeksAgo = (
  weekday: number,
  weeksAgo: number,
): Omit<FixtureDateParts, 'weekday'> => {
  for (let daysBack = 0; daysBack < 7; daysBack += 1) {
    const parts = getDateInFixtureTimezone(
      new Date(Date.now() - daysBack * 86_400_000),
    );

    if (parts.weekday === weekday) {
      return addDaysInFixtureTimezone(
        parts.year,
        parts.month,
        parts.day,
        -weeksAgo * 7,
      );
    }
  }

  throw new Error(
    `Could not find weekday ${weekday} in ${FIXTURE_TIMEZONE} calendar`,
  );
};

export const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * 3_600_000);

export const createAuthUser = async (
  db: Database,
  hashedPassword: string,
  input: {
    email: string;
    firstname: string;
    lastname: string;
    locale: 'en' | 'de';
    image?: string;
  },
): Promise<FixtureUser> => {
  const existing = await db.query.users.findFirst({
    where: { email: input.email },
  });

  if (existing) {
    if (input.image && !existing.image) {
      await db
        .update(schema.users)
        .set({ image: input.image })
        .where(eq(schema.users.id, existing.id));
    }
    return {
      id: existing.id,
      email: existing.email,
      firstname: existing.firstname,
      lastname: existing.lastname,
    };
  }

  const id = crypto.randomUUID();

  await db.insert(schema.users).values({
    id,
    name: formatUserName(input.firstname, input.lastname),
    firstname: input.firstname,
    lastname: input.lastname,
    email: input.email,
    emailVerified: true,
    locale: input.locale,
    image: input.image ?? null,
  });

  await db.insert(schema.accounts).values({
    id: crypto.randomUUID(),
    // better-auth resolves a credential account by `accountId === user.id`
    // (see its sign-in route), so the account id must be the user id — the
    // email here makes the fixture account unreachable for sign-in.
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashedPassword,
  });

  return {
    id,
    email: input.email,
    firstname: input.firstname,
    lastname: input.lastname,
  };
};

export const ensureMembershipWithRole = async (
  db: Database,
  userId: string,
  organizationUnitId: string,
  roleId: string,
): Promise<void> => {
  const existingMembership = await db.query.memberships.findFirst({
    where: { userId, organizationUnitId },
  });

  let membershipId: string;

  if (existingMembership) {
    membershipId = existingMembership.id;
  } else {
    const [membership] = await db
      .insert(schema.memberships)
      .values({ userId, organizationUnitId })
      .returning();

    if (!membership) {
      throw new Error('Failed to create membership');
    }

    membershipId = membership.id;
  }

  const existingRole = await db.query.membershipRoles.findFirst({
    where: { membershipId, roleId },
  });

  if (!existingRole) {
    await db.insert(schema.membershipRoles).values({
      membershipId,
      roleId,
    });
  }
};

export const pickRecentPastInstance = (
  instances: Array<typeof schema.shiftInstances.$inferSelect>,
): typeof schema.shiftInstances.$inferSelect => {
  const now = Date.now();
  const pastInstances = instances
    .filter((instance) => instance.actualStartsAt.getTime() < now)
    .sort(
      (left, right) =>
        right.actualStartsAt.getTime() - left.actualStartsAt.getTime(),
    );

  const instance = pastInstances[0] ?? instances[0];
  if (!instance) {
    throw new Error('Failed to resolve shift instance');
  }

  return instance;
};

export const ensureShiftWithInvites = async (
  db: Database,
  organizationUnitId: string,
  createdById: string,
  shift: ShiftFixture,
): Promise<{ shiftId: string; instanceId: string; instanceStartsAt: Date }> => {
  const durationMinutes =
    shift.durationMinutes ?? DEFAULT_SHIFT_DURATION_MINUTES;

  const existingShift = shift.id
    ? await db.query.shifts.findFirst({ where: { id: shift.id } })
    : await db.query.shifts.findFirst({
        where: { title: shift.title, organizationUnitId },
      });

  if (existingShift) {
    const instances = await db.query.shiftInstances.findMany({
      where: { masterId: existingShift.id },
    });

    const recentInstance = pickRecentPastInstance(instances);

    return {
      shiftId: existingShift.id,
      instanceId: recentInstance.id,
      instanceStartsAt: recentInstance.actualStartsAt,
    };
  }

  const [createdShift] = await db
    .insert(schema.shifts)
    .values({
      id: shift.id,
      title: shift.title,
      slug: slugify(shift.title),
      instructions: shift.instructions ?? null,
      location: shift.location ?? null,
      imageUrl: shift.imageUrl ?? null,
      organizationUnitId,
      createdById,
      visibility: shift.visibility ?? ShiftVisibility.INVITED_MEMBERS,
      joinRequiresApproval: shift.joinRequiresApproval ?? false,
      reimbursementTypeId: shift.reimbursementTypeId ?? null,
      maxVolunteers: shift.maxVolunteers ?? null,
      originalStartsAt: shift.startsAt,
      durationMinutes,
      rrule: shift.rrule,
      eventId: shift.eventId ?? null,
    })
    .returning();

  if (!createdShift) {
    throw new Error(`Failed to create shift: ${shift.title}`);
  }

  const instances = expandShift(shift.rrule, shift.startsAt, durationMinutes);
  const insertedInstances = await db
    .insert(schema.shiftInstances)
    .values(
      instances.map((instance) => ({
        masterId: createdShift.id,
        actualStartsAt: instance.actualStartsAt,
        actualEndsAt: instance.actualEndsAt,
        occurrenceIndex: instance.occurrenceIndex,
      })),
    )
    .returning();

  if (shift.inviteUserIds.length > 0) {
    await db.insert(schema.shiftInstanceInvites).values(
      insertedInstances.flatMap((instance) =>
        shift.inviteUserIds.map((userId) => ({
          instanceId: instance.id,
          userId,
          status: ShiftInviteStatus.JOINED,
        })),
      ),
    );
  }

  if (shift.pendingInviteUserIds && shift.pendingInviteUserIds.length > 0) {
    await db.insert(schema.shiftInstanceInvites).values(
      insertedInstances.flatMap((instance) =>
        (shift.pendingInviteUserIds ?? []).map((userId) => ({
          instanceId: instance.id,
          userId,
          status: ShiftInviteStatus.ADMIN_INVITED,
        })),
      ),
    );
  }

  for (const group of shift.extraInvites ?? []) {
    if (group.userIds.length === 0) {
      continue;
    }
    await db.insert(schema.shiftInstanceInvites).values(
      insertedInstances.flatMap((instance) =>
        group.userIds.map((userId) => ({
          instanceId: instance.id,
          userId,
          status: group.status,
        })),
      ),
    );
  }

  const recentInstance = pickRecentPastInstance(insertedInstances);

  return {
    shiftId: createdShift.id,
    instanceId: recentInstance.id,
    instanceStartsAt: recentInstance.actualStartsAt,
  };
};

export const ensureEvent = async (
  db: Database,
  organizationUnitId: string,
  createdById: string,
  event: FixtureEventInput,
): Promise<typeof schema.events.$inferSelect> => {
  const existingEvent = event.id
    ? await db.query.events.findFirst({ where: { id: event.id } })
    : await db.query.events.findFirst({
        where: { title: event.title, organizationUnitId },
      });

  if (existingEvent) {
    return existingEvent;
  }

  const [createdEvent] = await db
    .insert(schema.events)
    .values({
      id: event.id,
      title: event.title,
      slug: slugify(event.title),
      description: event.description ?? null,
      location: event.location ?? null,
      logoUrl: event.logoUrl ?? null,
      coverUrl: event.coverUrl ?? null,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      organizationUnitId,
      createdById,
    })
    .returning();

  if (!createdEvent) {
    throw new Error(`Failed to create event: ${event.title}`);
  }

  return createdEvent;
};

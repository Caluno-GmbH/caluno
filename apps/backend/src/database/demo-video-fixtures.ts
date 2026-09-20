/**
 * Demo dataset for the product videos ("Altonaer Lesepaten").
 *
 * Fully fictional non-profit reading-mentorship organisation, built to look
 * like a real Caluno customer on screen instead of the "testing+00X" Playground
 * fixtures. Completely independent from `fixtures.ts` — it creates its own
 * organisation, its own accounts and its own shifts/events, so re-running
 * `bun run src/database/fixtures.ts` (the Playground/e2e dataset) is
 * unaffected, and running this script never touches the Playground org.
 *
 * Usage (from apps/backend, after `bun bootstrap` or `bun run db:migrate` +
 * `bun run db:seed` have run at least once so permissions + reimbursement
 * types exist):
 *
 *   bun run db:fixtures:demo-video
 *
 * All accounts use the password from DEMO_FIXTURE_PASSWORD, default `abcd1234`.
 * All emails are on the `lesepaten-altona.example` domain — reserved by
 * RFC 2606 for documentation/demo use, so nothing is ever actually delivered.
 */
import { hashPassword } from 'better-auth/crypto';
import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ReimbursementTypeKey } from '../accounting/enums';
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
  MEMBER_DEFAULT_PERMISSIONS,
  PERMISSIONS,
} from '../auth/constants';
import { permissions } from '../auth/schemas/permission.schema';
import { MembershipRequestStatus } from '../membership/enums';
import { FieldType } from '../requirement-profile/enums';
import { ShiftInviteStatus, ShiftVisibility } from '../shift/enums';
import { expandShift } from '../shift/utils/rrule-expander';
import { slugify } from '../utils/slug.util';
import { relations } from './relations';
import * as schema from './schema';

process.env.TZ = 'Europe/Berlin';

const FIXTURE_PASSWORD = process.env.DEMO_FIXTURE_PASSWORD ?? 'abcd1234';
const ORG_NAME = 'Altonaer Lesepaten';
const ORG_SLUG = 'altonaer-lesepaten';
const EMAIL_DOMAIN = 'lesepaten-altona.example';
const FIXTURE_TIMEZONE = 'Europe/Berlin';
const RECURRENCE_WEEKS_BACK = 8;

// Real Unsplash photos (via the connected Unsplash search), one per
// event/shift/person context so screens look like a real customer instead
// of generic placeholder art. All from photographers who allow free use;
// if any of these stills end up in the published video, credit the
// photographer per Unsplash's license (photo -> photographer name is in
// the fixture comments below).
const ORG_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1776015625774-f7f7d1b55f79?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Boris Dobretsov — person on a park bench among trees
const LESESOMMER_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1614013556967-9f1d1e551e2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Drew Perales — girl reading on the beach in summer
const LESEFEST_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1774208770506-7d38eba4c26a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Nihar Bhagat — outdoor street market/fair
const LESEFEST_SHIFT_IMAGE_URL =
  'https://images.unsplash.com/photo-1767274098879-841a5d9d1001?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // You Le — street festival with crowds
const PARK_SHIFT_IMAGE_URL =
  'https://images.unsplash.com/photo-1759662280683-520528fb4c5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Sorin Basangeac — person reading an open book on a park bench
const VORLESESTUNDE_IMAGE_URL =
  'https://images.unsplash.com/photo-1763345756473-57a436a00e29?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Nish Gupta — person on a park bench in the sun
const ELISABETHSTIFT_IMAGE_URL =
  'https://images.unsplash.com/photo-1764173039117-e1ef87b26ec4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Centre for Ageing Better — two women looking at a book together
const SENIORENKREIS_IMAGE_URL =
  'https://images.unsplash.com/photo-1758691031036-5b7b635e30b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Vitaly Gariev — three seniors together with a photo album
const LITERATURKURS_IMAGE_URL =
  'https://images.unsplash.com/photo-1758270704080-e3556e6794a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Vitaly Gariev — teacher and adult students in a classroom

// One portrait per fixture person (via Unsplash search), keyed by local-part,
// so avatars look like real photos instead of initials placeholders.
const PORTRAIT_URLS: Record<string, string> = {
  'friederike.lange':
    'https://images.unsplash.com/photo-1706272971886-20f2fadf577e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Jonathan Cosens Photography
  'jonas.petersen':
    'https://images.unsplash.com/photo-1759786076452-099c90391521?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Hamed Hoseini Pur
  'hannah.reimers':
    'https://images.unsplash.com/photo-1760199824729-558c3e75bc5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Jack H. Park
  'mehmet.aydin':
    'https://images.unsplash.com/photo-1777827839146-d634aee2c991?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Md Mahdi
  'sophie.brandt':
    'https://images.unsplash.com/photo-1685560436288-8683b3697cc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Vladislav Anchuk
  'klaus.dietrich':
    'https://images.unsplash.com/photo-1560071072-02101fd1ed12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Alexandre Lecocq
  'layla.hoffmann':
    'https://images.unsplash.com/photo-1768447756321-792e5046d9eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // blue sky
  'tom.vogel':
    'https://images.unsplash.com/photo-1552915170-0d82a88c477d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Alex Guillaume
  'ingrid.neumann':
    'https://images.unsplash.com/photo-1776404527423-f94fda9f43aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Georgi Guruli
  'noah.fischer':
    'https://images.unsplash.com/photo-1536792414922-14b978901fcd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Ashwini Chaudhary
  'elif.yildiz':
    'https://images.unsplash.com/photo-1759786076510-b8490b7c7022?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Hamed Hoseini Pur
  'peter.schulz':
    'https://images.unsplash.com/photo-1597651711127-600d0c2e78b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Anand Thakur
  'lena.vogt':
    'https://images.unsplash.com/photo-1695013079138-d39ea65ab0b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // styvo Putra Sid
  'marie.albrecht':
    'https://images.unsplash.com/photo-1650381473833-3e2c74a40fbf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Alexander Krivitskiy
  'david.kern':
    'https://images.unsplash.com/photo-1608549950158-6d1dc2022ccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // nacer eddine
  'sabine.wolff':
    'https://images.unsplash.com/photo-1654762699761-b6d13143bb2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Ivan Kazlouskij
};

const WEEKLY_RRULE = {
  MONDAY: 'FREQ=WEEKLY;BYDAY=MO;WKST=MO',
  TUESDAY: 'FREQ=WEEKLY;BYDAY=TU;WKST=MO',
  WEDNESDAY: 'FREQ=WEEKLY;BYDAY=WE;WKST=MO',
  THURSDAY: 'FREQ=WEEKLY;BYDAY=TH;WKST=MO',
} as const;
const ONE_TIME_RRULE = 'FREQ=DAILY;COUNT=1';

const SUPERVISOR_ROLE_NAME = 'Koordinator:in vor Ort';
const SUPERVISOR_PERMISSIONS = [
  PERMISSIONS.ORG_VIEW,
  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.SHIFT_EDIT,
  PERMISSIONS.VOLUNTEER_VIEW,
  PERMISSIONS.CHECK_IN_MANAGE,
] as const;

type Database = NodePgDatabase<typeof relations>;

type FixtureUser = {
  id: string;
  email: string;
  name: string;
};

type FixtureDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

// ─── Date helpers (Europe/Berlin wall-clock math, mirrors fixtures.ts) ───

const getDateInFixtureTimezone = (instant: Date): FixtureDateParts => {
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

const fixtureWallClockToUtc = (
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

const addDaysInFixtureTimezone = (
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

const findWeekdayWeeksAgo = (
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

const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * 3_600_000);

// ─── Generic auth/membership helpers (mirrors fixtures.ts) ───

const createAuthUser = async (
  db: Database,
  hashedPassword: string,
  input: { email: string; name: string; image?: string },
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
    return { id: existing.id, email: existing.email, name: existing.name };
  }

  const id = crypto.randomUUID();

  await db.insert(schema.users).values({
    id,
    name: input.name,
    email: input.email,
    emailVerified: true,
    locale: 'de',
    image: input.image ?? null,
  });

  await db.insert(schema.accounts).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashedPassword,
  });

  return { id, email: input.email, name: input.name };
};

const ensureMembershipWithRole = async (
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

// ─── Organisation + org units ───

type OrganizationHandles = {
  organizationId: string;
  rootUnitId: string;
  unitIds: { nord: string; sued: string; west: string };
  ownerRoleId: string;
  memberRoleId: string;
  supervisorRoleId: string;
};

const ensureAltonaerLesepatenOrganization = async (
  db: Database,
  adminUserId: string,
): Promise<OrganizationHandles> => {
  const allPermissionKeys = Object.values(PERMISSIONS).filter(
    (permission) => !permission.startsWith('org-role:'),
  );

  const existingOrg = await db.query.organizations.findFirst({
    where: { slug: ORG_SLUG },
  });

  if (existingOrg) {
    const units = await db.query.organizationUnits.findMany({
      where: { organizationId: existingOrg.id },
    });
    const rootUnit = units.find((unit) => unit.parentId === null);
    const nord = units.find((unit) => unit.name === 'Lesepaten Nord');
    const sued = units.find((unit) => unit.name === 'Lesepaten Süd');
    const west = units.find((unit) => unit.name === 'Lesepaten West');

    if (!rootUnit || !nord || !sued || !west) {
      throw new Error(
        'Existing Altonaer Lesepaten organization is missing an expected unit — delete it and re-run, or extend this script instead of assuming its shape.',
      );
    }

    const roles = await db.query.roles.findMany({
      where: { organizationId: existingOrg.id },
    });
    const ownerRole = roles.find(
      (role) => role.name === DEFAULT_OWNER_ROLE_NAME,
    );
    const memberRole = roles.find(
      (role) => role.name === DEFAULT_MEMBER_ROLE_NAME,
    );
    const supervisorRole = roles.find(
      (role) => role.name === SUPERVISOR_ROLE_NAME,
    );

    if (!ownerRole || !memberRole || !supervisorRole) {
      throw new Error(
        'Existing Altonaer Lesepaten organization is missing expected roles',
      );
    }

    await ensureMembershipWithRole(db, adminUserId, rootUnit.id, ownerRole.id);

    return {
      organizationId: existingOrg.id,
      rootUnitId: rootUnit.id,
      unitIds: { nord: nord.id, sued: sued.id, west: west.id },
      ownerRoleId: ownerRole.id,
      memberRoleId: memberRole.id,
      supervisorRoleId: supervisorRole.id,
    };
  }

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(schema.organizations)
      .values({
        name: ORG_NAME,
        slug: ORG_SLUG,
        contactEmail: `kontakt@${EMAIL_DOMAIN}`,
        description:
          'Gemeinnütziger Verein: Ehrenamtliche begleiten Kinder, Senior:innen und Menschen mit Leseschwierigkeiten in Hamburg-Altona beim Lesen.',
        address: 'Museumstraße 23',
        city: 'Hamburg',
        zipCode: '22765',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create Altonaer Lesepaten organization');
    }

    const [rootType] = await tx
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: organization.id,
        name: 'Verein',
        description: `Trägerverein von ${organization.name}`,
        icon: 'building-2',
      })
      .returning();

    const [regionType] = await tx
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: organization.id,
        name: 'Regionalgruppe',
        description: 'Regionale Untergliederung der Lesepatenschaften',
        icon: 'map-pin',
      })
      .returning();

    if (!rootType || !regionType) {
      throw new Error('Failed to create organization unit types');
    }

    const [rootUnit] = await tx
      .insert(schema.organizationUnits)
      .values({
        organizationId: organization.id,
        parentId: null,
        typeId: rootType.id,
        name: organization.name,
        slug: ORG_SLUG,
        contactEmail: organization.contactEmail,
        description: organization.description,
        coverUrl: ORG_COVER_IMAGE_URL,
        address: 'Museumstraße 23',
        city: 'Hamburg',
        zipCode: '22765',
        legalRep: 'Friederike Lange',
      })
      .returning();

    if (!rootUnit) {
      throw new Error('Failed to create root organization unit');
    }

    const regionUnits: Record<'nord' | 'sued' | 'west', string> = {
      nord: '',
      sued: '',
      west: '',
    };

    const regionDefinitions: Array<{
      key: 'nord' | 'sued' | 'west';
      name: string;
      slug: string;
      description: string;
    }> = [
      {
        key: 'nord',
        name: 'Lesepaten Nord',
        slug: `${ORG_SLUG}-nord`,
        description: 'Eimsbüttel, Schnelsen, Stellingen',
      },
      {
        key: 'sued',
        name: 'Lesepaten Süd',
        slug: `${ORG_SLUG}-sued`,
        description: 'Ottensen, Bahrenfeld, Groß Flottbek',
      },
      {
        key: 'west',
        name: 'Lesepaten West',
        slug: `${ORG_SLUG}-west`,
        description: 'Rissen, Blankenese, Sülldorf',
      },
    ];

    for (const region of regionDefinitions) {
      const [unit] = await tx
        .insert(schema.organizationUnits)
        .values({
          organizationId: organization.id,
          parentId: rootUnit.id,
          typeId: regionType.id,
          name: region.name,
          slug: region.slug,
          contactEmail: organization.contactEmail,
          description: region.description,
          address: 'Museumstraße 23',
          city: 'Hamburg',
          zipCode: '22765',
        })
        .returning();

      if (!unit) {
        throw new Error(`Failed to create organization unit: ${region.name}`);
      }

      regionUnits[region.key] = unit.id;
    }

    const [ownerRole] = await tx
      .insert(schema.roles)
      .values({
        name: DEFAULT_OWNER_ROLE_NAME,
        description: `Owner role for organization ${organization.name}`,
        isInternal: true,
        organizationId: organization.id,
      })
      .returning();

    const [memberRole] = await tx
      .insert(schema.roles)
      .values({
        name: DEFAULT_MEMBER_ROLE_NAME,
        description: `Member role for organization ${organization.name}`,
        isInternal: true,
        organizationId: organization.id,
      })
      .returning();

    const [supervisorRole] = await tx
      .insert(schema.roles)
      .values({
        name: SUPERVISOR_ROLE_NAME,
        description: `Supervisor role for organization ${organization.name}`,
        isInternal: false,
        organizationId: organization.id,
      })
      .returning();

    if (!ownerRole || !memberRole || !supervisorRole) {
      throw new Error('Failed to create organization roles');
    }

    const memberPermissionRows = await tx
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, [...MEMBER_DEFAULT_PERMISSIONS]));

    if (memberPermissionRows.length > 0) {
      await tx.insert(schema.rolePermissions).values(
        memberPermissionRows.map((permission) => ({
          roleId: memberRole.id,
          permissionId: permission.id,
        })),
      );
    }

    const ownerPermissionRows = await tx
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, allPermissionKeys));

    if (ownerPermissionRows.length > 0) {
      await tx.insert(schema.rolePermissions).values(
        ownerPermissionRows.map((permission) => ({
          roleId: ownerRole.id,
          permissionId: permission.id,
        })),
      );
    }

    const supervisorPermissionRows = await tx
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, [...SUPERVISOR_PERMISSIONS]));

    if (supervisorPermissionRows.length > 0) {
      await tx.insert(schema.rolePermissions).values(
        supervisorPermissionRows.map((permission) => ({
          roleId: supervisorRole.id,
          permissionId: permission.id,
        })),
      );
    }

    const [adminMembership] = await tx
      .insert(schema.memberships)
      .values({ userId: adminUserId, organizationUnitId: rootUnit.id })
      .returning();

    if (!adminMembership) {
      throw new Error('Failed to create admin membership');
    }

    await tx.insert(schema.membershipRoles).values({
      membershipId: adminMembership.id,
      roleId: ownerRole.id,
    });

    return {
      organizationId: organization.id,
      rootUnitId: rootUnit.id,
      unitIds: regionUnits,
      ownerRoleId: ownerRole.id,
      memberRoleId: memberRole.id,
      supervisorRoleId: supervisorRole.id,
    };
  });
};

// ─── Shifts & events (mirrors fixtures.ts' ensureShiftWithInvites/ensureEvent) ───

type ShiftFixture = {
  id?: string;
  title: string;
  startsAt: Date;
  rrule: string;
  inviteUserIds: string[];
  durationMinutes: number;
  eventId?: string;
  visibility?: ShiftVisibility;
  maxVolunteers?: number;
  instructions?: string;
  location?: string;
  imageUrl?: string;
  pendingInviteUserIds?: string[];
  extraInvites?: Array<{ userIds: string[]; status: ShiftInviteStatus }>;
};

const pickRecentPastInstance = (
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

const ensureShiftWithInvites = async (
  db: Database,
  organizationUnitId: string,
  createdById: string,
  shift: ShiftFixture,
): Promise<{ shiftId: string; instanceId: string; instanceStartsAt: Date }> => {
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
      maxVolunteers: shift.maxVolunteers ?? null,
      originalStartsAt: shift.startsAt,
      durationMinutes: shift.durationMinutes,
      rrule: shift.rrule,
      eventId: shift.eventId ?? null,
    })
    .returning();

  if (!createdShift) {
    throw new Error(`Failed to create shift: ${shift.title}`);
  }

  const instances = expandShift(
    shift.rrule,
    shift.startsAt,
    shift.durationMinutes,
  );
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

const ensureEvent = async (
  db: Database,
  organizationUnitId: string,
  createdById: string,
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    coverUrl?: string | null;
    startsAt: Date;
    endsAt: Date;
  },
): Promise<typeof schema.events.$inferSelect> => {
  const existingEvent = await db.query.events.findFirst({
    where: { title: event.title, organizationUnitId },
  });

  if (existingEvent) {
    return existingEvent;
  }

  const [createdEvent] = await db
    .insert(schema.events)
    .values({
      title: event.title,
      slug: slugify(event.title),
      description: event.description ?? null,
      location: event.location ?? null,
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

// ─── Requirement forms (individuelle Anforderungsformulare & Dokumentenannahme) ───

const ensurePersonalInfoForm = async (
  db: Database,
  organizationId: string,
  organizationUnitId: string,
  createdById: string,
): Promise<typeof schema.requirementForms.$inferSelect> => {
  let form = await db.query.requirementForms.findFirst({
    where: { organizationId, slug: 'interessensbekundung' },
  });

  if (!form) {
    const [createdForm] = await db
      .insert(schema.requirementForms)
      .values({
        organizationId,
        organizationUnitId,
        slug: 'interessensbekundung',
        name: 'Interessensbekundung',
        description: 'Kontaktdaten für neue Ehrenamtliche.',
        shareToken: crypto.randomUUID(),
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!createdForm) {
      throw new Error('Failed to create Interessensbekundung form');
    }

    form = createdForm;

    const [block] = await db
      .insert(schema.formBlocks)
      .values({
        organizationId,
        title: 'Deine Kontaktdaten',
        description: 'Damit wir dich erreichen können.',
        required: true,
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!block) {
      throw new Error('Failed to create Interessensbekundung block');
    }

    await db.insert(schema.formBlockFields).values([
      {
        blockId: block.id,
        type: FieldType.NAME,
        label: 'Vorname',
        required: true,
        fieldOrder: 0,
      },
      {
        blockId: block.id,
        type: FieldType.LASTNAME,
        label: 'Nachname',
        required: true,
        fieldOrder: 1,
      },
      {
        blockId: block.id,
        type: FieldType.PHONE,
        label: 'Telefonnummer',
        required: false,
        fieldOrder: 2,
      },
    ]);

    await db.insert(schema.requirementFormBlockRefs).values({
      formId: form.id,
      blockId: block.id,
      fieldOrder: 0,
      required: true,
    });
  }

  const existingUnitRequiredForm =
    await db.query.organizationUnitRequiredForms.findFirst({
      where: { organizationUnitId, formId: form.id },
    });

  if (!existingUnitRequiredForm) {
    await db.insert(schema.organizationUnitRequiredForms).values({
      organizationUnitId,
      formId: form.id,
      order: 0,
    });
  }

  return form;
};

const ensureAgreementForm = async (
  db: Database,
  organizationId: string,
  organizationUnitId: string,
  createdById: string,
): Promise<typeof schema.requirementForms.$inferSelect> => {
  let form = await db.query.requirementForms.findFirst({
    where: { organizationId, slug: 'vereinbarung-ehrenamtliche-mitarbeit' },
  });

  if (!form) {
    const [createdForm] = await db
      .insert(schema.requirementForms)
      .values({
        organizationId,
        organizationUnitId,
        slug: 'vereinbarung-ehrenamtliche-mitarbeit',
        name: 'Vereinbarung zur ehrenamtlichen Mitarbeit',
        description:
          'Bestätigung, dass die Vereinbarung zur ehrenamtlichen Mitarbeit gelesen wurde.',
        shareToken: crypto.randomUUID(),
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!createdForm) {
      throw new Error('Failed to create Vereinbarung form');
    }

    form = createdForm;

    const [block] = await db
      .insert(schema.formBlocks)
      .values({
        organizationId,
        title: 'Vereinbarung zur ehrenamtlichen Mitarbeit',
        description:
          'Bitte einmal lesen und bestätigen, bevor es in den ersten Einsatz geht.',
        required: true,
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!block) {
      throw new Error('Failed to create Vereinbarung block');
    }

    await db.insert(schema.formBlockFields).values({
      blockId: block.id,
      type: FieldType.DOCUMENT_ACKNOWLEDGEMENT,
      label: 'Ich habe die Vereinbarung zur ehrenamtlichen Mitarbeit gelesen',
      required: true,
      fieldOrder: 0,
    });

    await db.insert(schema.requirementFormBlockRefs).values({
      formId: form.id,
      blockId: block.id,
      fieldOrder: 0,
      required: true,
    });
  }

  const existingUnitRequiredForm =
    await db.query.organizationUnitRequiredForms.findFirst({
      where: { organizationUnitId, formId: form.id },
    });

  if (!existingUnitRequiredForm) {
    await db.insert(schema.organizationUnitRequiredForms).values({
      organizationUnitId,
      formId: form.id,
      order: 1,
    });
  }

  return form;
};

/** Shift-specific form: erweitertes Führungszeugnis, required only for
 * shifts that work directly with children (VOLI use case: "individuelle
 * Anforderungsformulare" — different forms depending on context, not just
 * one org-wide form). */
const ensureChildSafetyForm = async (
  db: Database,
  organizationId: string,
  organizationUnitId: string,
  createdById: string,
  shiftId: string,
): Promise<typeof schema.requirementForms.$inferSelect> => {
  let form = await db.query.requirementForms.findFirst({
    where: { organizationId, slug: 'erweitertes-fuehrungszeugnis' },
  });

  if (!form) {
    const [createdForm] = await db
      .insert(schema.requirementForms)
      .values({
        organizationId,
        organizationUnitId,
        slug: 'erweitertes-fuehrungszeugnis',
        name: 'Erweitertes Führungszeugnis',
        description: 'Für Einsätze mit Kindern erforderlich.',
        shareToken: crypto.randomUUID(),
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!createdForm) {
      throw new Error('Failed to create Führungszeugnis form');
    }

    form = createdForm;

    const [block] = await db
      .insert(schema.formBlocks)
      .values({
        organizationId,
        title: 'Erweitertes Führungszeugnis',
        description: 'Ausstellungsdatum des vorgelegten Führungszeugnisses.',
        required: true,
        createdBy: createdById,
        updatedBy: createdById,
      })
      .returning();

    if (!block) {
      throw new Error('Failed to create Führungszeugnis block');
    }

    await db.insert(schema.formBlockFields).values({
      blockId: block.id,
      type: FieldType.DATE,
      label: 'Ausstellungsdatum',
      required: true,
      fieldOrder: 0,
    });

    await db.insert(schema.requirementFormBlockRefs).values({
      formId: form.id,
      blockId: block.id,
      fieldOrder: 0,
      required: true,
    });
  }

  const existingShiftRequiredForm = await db.query.shiftRequiredForms.findFirst(
    {
      where: { shiftId, formId: form.id },
    },
  );

  if (!existingShiftRequiredForm) {
    await db.insert(schema.shiftRequiredForms).values({
      shiftId,
      formId: form.id,
      order: 0,
    });
  }

  return form;
};

// ─── Main ───

async function seedDemoVideoFixtures() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });

  const db = drizzle({ client: pool, relations });

  const hashedPassword = await hashPassword(FIXTURE_PASSWORD);

  const email = (localPart: string) => `${localPart}@${EMAIL_DOMAIN}`;

  const coordinator = await createAuthUser(db, hashedPassword, {
    email: email('friederike.lange'),
    name: 'Friederike Lange',
    image: PORTRAIT_URLS['friederike.lange'],
  });

  const org = await ensureAltonaerLesepatenOrganization(db, coordinator.id);

  await ensurePersonalInfoForm(
    db,
    org.organizationId,
    org.rootUnitId,
    coordinator.id,
  );
  await ensureAgreementForm(
    db,
    org.organizationId,
    org.rootUnitId,
    coordinator.id,
  );

  const supervisor = await createAuthUser(db, hashedPassword, {
    email: email('jonas.petersen'),
    name: 'Jonas Petersen',
    image: PORTRAIT_URLS['jonas.petersen'],
  });
  await ensureMembershipWithRole(
    db,
    supervisor.id,
    org.unitIds.nord,
    org.supervisorRoleId,
  );

  const memberDefinitions: Array<{
    localPart: string;
    name: string;
    unit: 'nord' | 'sued' | 'west';
  }> = [
    { localPart: 'hannah.reimers', name: 'Hannah Reimers', unit: 'nord' },
    { localPart: 'mehmet.aydin', name: 'Mehmet Aydın', unit: 'nord' },
    { localPart: 'sophie.brandt', name: 'Sophie Brandt', unit: 'nord' },
    { localPart: 'klaus.dietrich', name: 'Klaus Dietrich', unit: 'sued' },
    { localPart: 'layla.hoffmann', name: 'Layla Hoffmann', unit: 'sued' },
    { localPart: 'tom.vogel', name: 'Tom Vogel', unit: 'sued' },
    { localPart: 'ingrid.neumann', name: 'Ingrid Neumann', unit: 'sued' },
    { localPart: 'noah.fischer', name: 'Noah Fischer', unit: 'west' },
    { localPart: 'elif.yildiz', name: 'Elif Yıldız', unit: 'west' },
    { localPart: 'peter.schulz', name: 'Peter Schulz', unit: 'west' },
  ];

  const members: Array<FixtureUser & { unit: 'nord' | 'sued' | 'west' }> = [];
  for (const definition of memberDefinitions) {
    const user = await createAuthUser(db, hashedPassword, {
      email: email(definition.localPart),
      name: definition.name,
      image: PORTRAIT_URLS[definition.localPart],
    });
    await ensureMembershipWithRole(
      db,
      user.id,
      org.unitIds[definition.unit],
      org.memberRoleId,
    );
    members.push({ ...user, unit: definition.unit });
  }

  // The account to log into for the videos: a member with a realistic mix
  // of accepted, pending and self-joined shifts (mirrors the Playground
  // "Demo Volunteer" pattern), plus complete personal/banking-style data.
  const demoUser = await createAuthUser(db, hashedPassword, {
    email: email('lena.vogt'),
    name: 'Lena Vogt',
    image: PORTRAIT_URLS['lena.vogt'],
  });
  await ensureMembershipWithRole(
    db,
    demoUser.id,
    org.unitIds.nord,
    org.memberRoleId,
  );
  members.push({ ...demoUser, unit: 'nord' });

  const byUnit = (unit: 'nord' | 'sued' | 'west') =>
    members.filter((member) => member.unit === unit);

  // Pending / rejected Interessensbekundungen (Use Case 1: Einladen & Verwalten)
  const pendingApplicants = await Promise.all(
    [
      { localPart: 'marie.albrecht', name: 'Marie Albrecht' },
      { localPart: 'david.kern', name: 'David Kern' },
    ].map((applicant) =>
      createAuthUser(db, hashedPassword, {
        email: email(applicant.localPart),
        name: applicant.name,
        image: PORTRAIT_URLS[applicant.localPart],
      }),
    ),
  );

  const rejectedApplicant = await createAuthUser(db, hashedPassword, {
    email: email('sabine.wolff'),
    name: 'Sabine Wolff',
    image: PORTRAIT_URLS['sabine.wolff'],
  });

  const ensureMembershipRequest = async (
    userId: string,
    organizationUnitId: string,
    status: MembershipRequestStatus,
    extra: Partial<typeof schema.membershipRequests.$inferInsert> = {},
  ): Promise<void> => {
    const existing = await db.query.membershipRequests.findFirst({
      where: { userId, organizationUnitId },
    });

    if (!existing) {
      await db.insert(schema.membershipRequests).values({
        userId,
        organizationUnitId,
        status,
        ...extra,
      });
    }
  };

  for (const applicant of pendingApplicants) {
    await ensureMembershipRequest(
      applicant.id,
      org.rootUnitId,
      MembershipRequestStatus.PENDING,
    );
  }

  await ensureMembershipRequest(
    rejectedApplicant.id,
    org.rootUnitId,
    MembershipRequestStatus.REJECTED,
    {
      reviewedById: coordinator.id,
      reviewedAt: new Date(),
      rejectionReason:
        'Interessensbekundung nach Rücksprache nicht weiterverfolgt.',
    },
  );

  // ─── Shifts (Use Case 2: Einsätze planen & Ehrenamtliche einladen) ───

  const anchor = (weekday: number) =>
    findWeekdayWeeksAgo(weekday, RECURRENCE_WEEKS_BACK);

  const parkStart = fixtureWallClockToUtc(
    anchor(2).year,
    anchor(2).month,
    anchor(2).day,
    15,
  );
  const elisabethstiftStart = fixtureWallClockToUtc(
    anchor(4).year,
    anchor(4).month,
    anchor(4).day,
    10,
  );
  const seniorenkreisStart = fixtureWallClockToUtc(
    anchor(1).year,
    anchor(1).month,
    anchor(1).day,
    14,
  );
  const literaturStart = fixtureWallClockToUtc(
    anchor(3).year,
    anchor(3).month,
    anchor(3).day,
    17,
  );

  // "Lesen im Park": frei wählbar (ALL_MEMBERS), begrenzte Plätze +
  // eine Warteliste — demonstriert Wartelisten.
  const nordMembers = byUnit('nord');
  const lesenImPark = await ensureShiftWithInvites(
    db,
    org.unitIds.nord,
    coordinator.id,
    {
      title: 'Lesen im Park',
      startsAt: parkStart,
      rrule: WEEKLY_RRULE.TUESDAY,
      durationMinutes: 90,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 3,
      instructions:
        'Vorlesen für Kinder und Familien auf der Picknickdecke im Altonaer Volkspark. Bücher stellen wir, gerne aber auch eigene Lieblingsbücher mitbringen.',
      location: 'Altonaer Volkspark, Haupteingang Kieler Straße',
      imageUrl: PARK_SHIFT_IMAGE_URL,
      inviteUserIds: nordMembers.slice(0, 3).map((member) => member.id),
      extraInvites: nordMembers[3]
        ? [
            {
              userIds: [nordMembers[3].id],
              status: ShiftInviteStatus.WAITLIST_JOINED,
            },
          ]
        : [],
    },
  );

  await ensureChildSafetyForm(
    db,
    org.organizationId,
    org.unitIds.nord,
    coordinator.id,
    lesenImPark.shiftId,
  );

  // "Lesen im Elisabethstift": direktes Einladen (INVITED_MEMBERS).
  const suedMembers = byUnit('sued');
  const lesenImElisabethstift = await ensureShiftWithInvites(
    db,
    org.unitIds.sued,
    coordinator.id,
    {
      title: 'Lesen im Elisabethstift',
      startsAt: elisabethstiftStart,
      rrule: WEEKLY_RRULE.THURSDAY,
      durationMinutes: 90,
      visibility: ShiftVisibility.INVITED_MEMBERS,
      maxVolunteers: 4,
      instructions:
        'Vorlesestunde im Aufenthaltsraum des Elisabethstifts. Bitte 10 Minuten vorher am Empfang melden.',
      location: 'Seniorenzentrum Elisabethstift, Bernadottestraße',
      imageUrl: ELISABETHSTIFT_IMAGE_URL,
      inviteUserIds: suedMembers.slice(0, 2).map((member) => member.id),
      pendingInviteUserIds: suedMembers[2] ? [suedMembers[2].id] : [],
    },
  );

  // "Seniorenkreis": Freigabeprozess — eine Person hat sich beworben,
  // wartet auf Zusage.
  const seniorenkreis = await ensureShiftWithInvites(
    db,
    org.unitIds.sued,
    coordinator.id,
    {
      title: 'Seniorenkreis',
      startsAt: seniorenkreisStart,
      rrule: WEEKLY_RRULE.MONDAY,
      durationMinutes: 120,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 4,
      instructions:
        'Gemeinsames Lesen und Gespräch im wöchentlichen Seniorenkreis. Kaffee und Kuchen stellt das Elisabethstift.',
      location: 'Seniorenzentrum Elisabethstift, Gemeinschaftsraum',
      imageUrl: SENIORENKREIS_IMAGE_URL,
      inviteUserIds: suedMembers.slice(0, 1).map((member) => member.id),
      extraInvites: suedMembers[3]
        ? [
            {
              userIds: [suedMembers[3].id],
              status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
            },
          ]
        : [],
    },
  );

  // "Deutsche Literatur für Anfänger": Übungsleiterpauschale-Kontext.
  const westMembers = byUnit('west');
  const literaturKurs = await ensureShiftWithInvites(
    db,
    org.unitIds.west,
    coordinator.id,
    {
      title: 'Deutsche Literatur für Anfänger',
      startsAt: literaturStart,
      rrule: WEEKLY_RRULE.WEDNESDAY,
      durationMinutes: 90,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Lesekurs für Erwachsene, die Deutsch lernen. Einfache Texte, viel Zeit zum Üben und Nachfragen.',
      location: 'Bücherhalle Rissen, Gruppenraum 1',
      imageUrl: LITERATURKURS_IMAGE_URL,
      inviteUserIds: westMembers.slice(0, 2).map((member) => member.id),
    },
  );

  // ─── Events (Lesesommer / Lesefest) ───

  const today = getDateInFixtureTimezone(new Date());
  const lesesommerStartDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    10,
  );
  const lesesommerEndDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    70,
  );
  const lesesommerStart = fixtureWallClockToUtc(
    lesesommerStartDay.year,
    lesesommerStartDay.month,
    lesesommerStartDay.day,
    9,
  );
  const lesesommerEnd = fixtureWallClockToUtc(
    lesesommerEndDay.year,
    lesesommerEndDay.month,
    lesesommerEndDay.day,
    18,
  );

  const lesesommer = await ensureEvent(db, org.rootUnitId, coordinator.id, {
    title: 'Lesesommer',
    description:
      'Zehn Wochen lang Vorlesestunden an drei Standorten in Altona — für alle, die im Sommer draußen vorlesen oder zuhören möchten.',
    location: 'Verschiedene Standorte in Hamburg-Altona',
    coverUrl: LESESOMMER_COVER_IMAGE_URL,
    startsAt: lesesommerStart,
    endsAt: lesesommerEnd,
  });

  const vorlesestundeDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    12,
  );
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Vorlesestunde im Stadtpark',
    startsAt: fixtureWallClockToUtc(
      vorlesestundeDay.year,
      vorlesestundeDay.month,
      vorlesestundeDay.day,
      16,
    ),
    rrule: 'FREQ=WEEKLY;COUNT=10',
    durationMinutes: 60,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 6,
    instructions: 'Teil des Lesesommer-Programms: Vorlesen für Familien.',
    location: 'Altonaer Volkspark, Musikpavillon',
    imageUrl: VORLESESTUNDE_IMAGE_URL,
    eventId: lesesommer.id,
    inviteUserIds: [],
    pendingInviteUserIds: [demoUser.id],
  });

  const lesefestDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    45,
  );
  const lesefestStart = fixtureWallClockToUtc(
    lesefestDay.year,
    lesefestDay.month,
    lesefestDay.day,
    11,
  );
  const lesefest = await ensureEvent(db, org.rootUnitId, coordinator.id, {
    title: 'Lesefest',
    description:
      'Eintägiges Straßenfest zum Abschluss des Lesesommers: Lesungen, Bücherflohmarkt und ein Programm für Kinder.',
    location: 'Platz der Republik, Hamburg-Altona',
    coverUrl: LESEFEST_COVER_IMAGE_URL,
    startsAt: lesefestStart,
    endsAt: addHours(lesefestStart, 6),
  });

  await ensureShiftWithInvites(db, org.rootUnitId, coordinator.id, {
    title: 'Standbetreuung Lesefest',
    startsAt: lesefestStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 360,
    visibility: ShiftVisibility.ALL_MEMBERS,
    instructions:
      'Auf- und Abbau des Lesepaten-Stands, Ansprechpartner:in für Besucher:innen den ganzen Tag über.',
    location: 'Platz der Republik, Stand 12',
    imageUrl: LESEFEST_SHIFT_IMAGE_URL,
    eventId: lesefest.id,
    inviteUserIds: [demoUser.id, ...members.slice(0, 3).map((m) => m.id)],
  });

  // ─── Zeiterfassung (Use Case 3), getrennt nach Pauschalenart (Use Case 4) ───

  const reimbursementTypes = await db.query.reimbursementTypes.findMany({
    where: {
      key: {
        in: [ReimbursementTypeKey.EHRENAMT, ReimbursementTypeKey.UEBUNGSLEITER],
      },
    },
  });
  const ehrenamtType = reimbursementTypes.find(
    (type) => type.key === ReimbursementTypeKey.EHRENAMT,
  );
  const uebungsleiterType = reimbursementTypes.find(
    (type) => type.key === ReimbursementTypeKey.UEBUNGSLEITER,
  );

  if (!ehrenamtType || !uebungsleiterType) {
    console.warn(
      'Reimbursement types not found — run `bun run db:seed` first so this script can tag time entries by Pauschalenart. Skipping time entries.',
    );
  } else {
    const existingEntries = await db.query.timeEntries.findMany({
      where: {
        shiftInstanceId: {
          in: [
            lesenImElisabethstift.instanceId,
            seniorenkreis.instanceId,
            literaturKurs.instanceId,
          ],
        },
      },
    });

    if (existingEntries.length === 0) {
      const entries: Array<typeof schema.timeEntries.$inferInsert> = [];

      for (const [index, member] of suedMembers.slice(0, 2).entries()) {
        entries.push({
          shiftInstanceId: lesenImElisabethstift.instanceId,
          organizationUnitId: org.unitIds.sued,
          volunteerId: member.id,
          reimbursementTypeId: ehrenamtType.id,
          startedAt: addHours(lesenImElisabethstift.instanceStartsAt, 0),
          endedAt: addHours(lesenImElisabethstift.instanceStartsAt, 1.5),
          notes: 'Vorlesestunde Elisabethstift — manuell erfasst',
        });

        entries.push({
          shiftInstanceId: seniorenkreis.instanceId,
          organizationUnitId: org.unitIds.sued,
          volunteerId: member.id,
          reimbursementTypeId: ehrenamtType.id,
          startedAt: addHours(seniorenkreis.instanceStartsAt, index * 0.25),
          endedAt: addHours(seniorenkreis.instanceStartsAt, 2 + index * 0.25),
          notes: 'Seniorenkreis — QR-Check-in vor Ort',
        });
      }

      for (const member of westMembers.slice(0, 2)) {
        entries.push({
          shiftInstanceId: literaturKurs.instanceId,
          organizationUnitId: org.unitIds.west,
          volunteerId: member.id,
          reimbursementTypeId: uebungsleiterType.id,
          startedAt: addHours(literaturKurs.instanceStartsAt, 0),
          endedAt: addHours(literaturKurs.instanceStartsAt, 1.5),
          notes: 'Lesekurs — Übungsleiterpauschale',
        });
      }

      if (entries.length > 0) {
        await db.insert(schema.timeEntries).values(entries);
      }
    }
  }

  // No admin UI to toggle accountingEnabled yet.
  await db
    .update(schema.organizations)
    .set({ accountingEnabled: true })
    .where(eq(schema.organizations.id, org.organizationId));

  console.log(
    `Created Altonaer Lesepaten organization (${org.organizationId})`,
  );
  console.log(
    `Units: Lesepaten Nord (${org.unitIds.nord}), Lesepaten Süd (${org.unitIds.sued}), Lesepaten West (${org.unitIds.west})`,
  );
  console.log(
    `Login (Koordinatorin): ${coordinator.email} / ${FIXTURE_PASSWORD}`,
  );
  console.log(
    `Login (Demo-Ehrenamtliche für Screens): ${demoUser.email} / ${FIXTURE_PASSWORD}`,
  );
  console.log(
    'Shifts: Lesen im Park (Warteliste), Lesen im Elisabethstift (direkt eingeladen), Seniorenkreis (Freigabe ausstehend), Deutsche Literatur für Anfänger',
  );
  console.log('Events: Lesesommer (mit Vorlesestunde im Stadtpark), Lesefest');
  console.log(
    'Anforderungsformulare: Interessensbekundung + Vereinbarung zur ehrenamtlichen Mitarbeit (Verein), Erweitertes Führungszeugnis (Lesen im Park)',
  );
  console.log(
    'Mitgliedschaften: 2 ausstehend (Marie Albrecht, David Kern), 1 abgelehnt (Sabine Wolff)',
  );

  await pool.end();
}

seedDemoVideoFixtures().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Realistic demo dataset ("Altonaer Lesepaten") for local development,
 * demos and manual testing.
 *
 * Fully fictional non-profit reading-mentorship organisation, built to look
 * like a real Caluno customer instead of the "testing+00X" Playground
 * fixtures. Completely independent from `fixtures.ts` — it creates its own
 * organisation, its own accounts and its own shifts/events, so re-running
 * `bun run src/database/fixtures.ts` (the Playground/e2e dataset) is
 * unaffected, and running this script never touches the Playground org.
 *
 * Usage (from apps/backend, after `bun bootstrap` or `bun run db:migrate` +
 * `bun run db:seed` have run at least once so permissions + reimbursement
 * types exist):
 *
 *   bun run db:fixtures:demo
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
// if any of these images are used publicly, credit the
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
const KITA_IMAGE_URL =
  'https://images.unsplash.com/photo-1583468982228-19f19164aee2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Adam Winger — woman and child reading together in a library
const DEUTSCH_LERNEN_IMAGE_URL =
  'https://images.unsplash.com/photo-1583468991267-3f068b607ae1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Adam Winger — woman reading to children in a library
const BUECHERBUS_IMAGE_URL =
  'https://images.unsplash.com/photo-1708653584807-b3c1c65a5807?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Raylor Photo — portable bookshelf cart in a park
const VORLESEWETTBEWERB_IMAGE_URL =
  'https://images.unsplash.com/photo-1742659708021-fde30a5a74b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Kabila Haile Soboka — a young girl reads a book on stage
const INTERKULTURELLER_LESETAG_IMAGE_URL =
  'https://images.unsplash.com/photo-1739302750691-59c12d251139?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Ninthgrid — three women sitting together looking at a book
const NORD_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1610070835951-156b6921281d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Beth Macdonald — group sitting in a circle on grass, reading-circle feel

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
  // 19 additional Lesepaten-Nord-Freiwillige (insgesamt 23 mit den obigen vier).
  'julia.schroeder':
    'https://images.unsplash.com/photo-1662850886700-4ec19bd30d11?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Nolan Manning
  'finn.kowalski':
    'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Elizeu Dias
  'amara.boateng':
    'https://images.unsplash.com/photo-1669844444850-5acd7e8c71c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Christopher John
  'paul.lehmann':
    'https://images.unsplash.com/photo-1625241152315-4a698f74ceb7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Nicolas Horn
  'zeynep.demir':
    'https://images.unsplash.com/photo-1562337404-3044c84ac061?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Kate Kozyrka
  'clara.winkler':
    'https://images.unsplash.com/photo-1612203304476-2ed23c55b5b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // HamZa NOUASRIA
  'leon.kraus':
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Warren
  'fatima.elamin':
    'https://images.unsplash.com/photo-1604072366595-e75dc92d6bdc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Jorik Kleen
  'tobias.richter':
    'https://images.unsplash.com/photo-1764084052338-23a317e34ea1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Sophie Paterson
  'greta.sommer':
    'https://images.unsplash.com/photo-1609436132311-e4b0c9370469?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Andre Styles
  'ali.hassan':
    'https://images.unsplash.com/photo-1774437678715-fb40846dc252?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Tanmay Abhay Mahajan
  'marlene.vogel':
    'https://images.unsplash.com/photo-1630939687530-241d630735df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Luca Nicoletti
  'tarek.younes':
    'https://images.unsplash.com/photo-1764084051711-45a3b7c84c06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Sophie Paterson
  'nele.krueger':
    'https://images.unsplash.com/photo-1609371497456-3a55a205d5eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Andre Styles
  'milan.petrov':
    'https://images.unsplash.com/photo-1564564244660-5d73c057f2d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Irene Strong
  'ida.wagner':
    'https://images.unsplash.com/photo-1758686254593-7c4cd55b2621?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Vitaly Gariev
  'samuel.owusu':
    'https://images.unsplash.com/photo-1758337779808-6c64838afda1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // litoon dev
  'franziska.berg':
    'https://images.unsplash.com/photo-1778368281721-94839cd797ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Sophie Dyson
  'yusuf.kaya':
    'https://images.unsplash.com/photo-1729862939068-de7a9e2209b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', // Bennie Bates
};

const WEEKLY_RRULE = {
  MONDAY: 'FREQ=WEEKLY;BYDAY=MO;WKST=MO',
  TUESDAY: 'FREQ=WEEKLY;BYDAY=TU;WKST=MO',
  WEDNESDAY: 'FREQ=WEEKLY;BYDAY=WE;WKST=MO',
  THURSDAY: 'FREQ=WEEKLY;BYDAY=TH;WKST=MO',
  FRIDAY: 'FREQ=WEEKLY;BYDAY=FR;WKST=MO',
} as const;
const BIWEEKLY_THURSDAY_RRULE = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;WKST=MO';
const SATURDAY_SIX_WEEKS_RRULE = 'FREQ=WEEKLY;BYDAY=SA;COUNT=6';
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
        zipCode: '22765',
        city: 'Hamburg',
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
        zipCode: '22765',
        city: 'Hamburg',
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
          coverUrl: region.key === 'nord' ? NORD_COVER_IMAGE_URL : null,
          address: 'Museumstraße 23',
          zipCode: '22765',
          city: 'Hamburg',
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
  joinRequiresApproval?: boolean;
  reimbursementTypeId?: string;
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
      joinRequiresApproval: shift.joinRequiresApproval ?? false,
      reimbursementTypeId: shift.reimbursementTypeId ?? null,
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

async function seedDemoFixtures() {
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

  // Resolved up front (not just before the Zeiterfassung block) so shifts
  // below can also be tagged by Pauschalenart: einige Einsätze mit
  // Ehrenamtspauschale, einige mit Übungsleiterpauschale, der Rest ohne.
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
      'Reimbursement types not found — run `bun run db:seed` first so this script can tag shifts/time entries by Pauschalenart. Continuing without them.',
    );
  }

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

  // The primary demo account: a member with a realistic mix
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

  // 19 weitere Freiwillige für Lesepaten Nord (zusammen mit den vier oben:
  // 23 insgesamt). Bewusst NACH Lena Vogt angelegt, damit bestehende
  // Referenzen wie nordMembers[3] weiterhin auf sie zeigen, statt sich zu
  // verschieben. Ohne weitere Einsatz-Zuordnung — sie zählen zur
  // Mitgliederliste und tauchen unten in der Zeiterfassung auf.
  const additionalNordMemberDefinitions: Array<{
    localPart: string;
    name: string;
  }> = [
    { localPart: 'julia.schroeder', name: 'Julia Schröder' },
    { localPart: 'finn.kowalski', name: 'Finn Kowalski' },
    { localPart: 'amara.boateng', name: 'Amara Boateng' },
    { localPart: 'paul.lehmann', name: 'Paul Lehmann' },
    { localPart: 'zeynep.demir', name: 'Zeynep Demir' },
    { localPart: 'clara.winkler', name: 'Clara Winkler' },
    { localPart: 'leon.kraus', name: 'Leon Kraus' },
    { localPart: 'fatima.elamin', name: 'Fatima El-Amin' },
    { localPart: 'tobias.richter', name: 'Tobias Richter' },
    { localPart: 'greta.sommer', name: 'Greta Sommer' },
    { localPart: 'ali.hassan', name: 'Ali Hassan' },
    { localPart: 'marlene.vogel', name: 'Marlene Vogel' },
    { localPart: 'tarek.younes', name: 'Tarek Younes' },
    { localPart: 'nele.krueger', name: 'Nele Krüger' },
    { localPart: 'milan.petrov', name: 'Milan Petrov' },
    { localPart: 'ida.wagner', name: 'Ida Wagner' },
    { localPart: 'samuel.owusu', name: 'Samuel Owusu' },
    { localPart: 'franziska.berg', name: 'Franziska Berg' },
    { localPart: 'yusuf.kaya', name: 'Yusuf Kaya' },
  ];

  const additionalNordMembers: FixtureUser[] = [];
  for (const definition of additionalNordMemberDefinitions) {
    const user = await createAuthUser(db, hashedPassword, {
      email: email(definition.localPart),
      name: definition.name,
      image: PORTRAIT_URLS[definition.localPart],
    });
    await ensureMembershipWithRole(
      db,
      user.id,
      org.unitIds.nord,
      org.memberRoleId,
    );
    members.push({ ...user, unit: 'nord' });
    additionalNordMembers.push(user);
  }

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

  // Used to place one-off (non-recurring) shifts in the current/next week,
  // so the near-term calendar looks like a real one instead of a perfectly
  // even grid of weekly series (some days busy, some empty, some doubled up).
  const today = getDateInFixtureTimezone(new Date());
  const daysUntilWeekday = (weekday: number): number =>
    (weekday - today.weekday + 7) % 7;

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

  // ─── Weitere Einsätze für Lesepaten Nord, damit der Einsatzkalender nicht
  // nur einen einzigen Einsatz zeigt. Bewusst UNGLEICHMÄSSIG statt "ein
  // Termin pro Wochentag, für immer" — echte Vereinskalender sehen so aus:
  // manche Tage haben mehrere Dinge, manche nichts, manches ist eine Serie,
  // manches ein Einzeltermin, mal mit direkter Einladung, mal offen, mal mit
  // Freigabe, mal ohne. Nur drei der folgenden Einsätze sind unbegrenzt
  // wiederkehrend (Kita montags, Park dienstags, Bücherbus zweiwöchentlich
  // donnerstags) — der Rest sind Einzeltermine oder eine befristete Reihe,
  // bewusst in dieser und der kommenden Woche platziert. ───

  const kitaStart = fixtureWallClockToUtc(
    anchor(1).year,
    anchor(1).month,
    anchor(1).day,
    9,
    30,
  );

  // "Vorlesepatenschaft Kita Sonnenschein": feste 1:1-Patenschaft, deshalb
  // direktes Einladen und (wie "Lesen im Park") das Führungszeugnis-Formular.
  const kitaSonnenschein = await ensureShiftWithInvites(
    db,
    org.unitIds.nord,
    coordinator.id,
    {
      title: 'Vorlesepatenschaft Kita Sonnenschein',
      startsAt: kitaStart,
      rrule: WEEKLY_RRULE.MONDAY,
      durationMinutes: 60,
      visibility: ShiftVisibility.INVITED_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Feste 1:1-Vorlesepatenschaft für ein Kita-Kind. Ablauf und Ansprechpartnerin vor Ort bespricht die Kita beim ersten Termin.',
      location: 'Kita Sonnenschein, Fruchtallee',
      imageUrl: KITA_IMAGE_URL,
      reimbursementTypeId: uebungsleiterType?.id,
      inviteUserIds: nordMembers.slice(0, 2).map((member) => member.id),
    },
  );

  await ensureChildSafetyForm(
    db,
    org.organizationId,
    org.unitIds.nord,
    coordinator.id,
    kitaSonnenschein.shiftId,
  );

  const lesecafeDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(3),
  );
  const lesecafeStart = fixtureWallClockToUtc(
    lesecafeDay.year,
    lesecafeDay.month,
    lesecafeDay.day,
    15,
    30,
  );

  // "Lesecafé für Senior:innen Eimsbüttel": Einzeltermin diese Woche, ohne
  // Bild, komplett offen — niemand ist vorab eingeladen oder muss sich
  // freischalten lassen (Kontrast zu Park/Kita/Deutsch-lernen unten).
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Lesecafé für Senior:innen Eimsbüttel',
    startsAt: lesecafeStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 90,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 4,
    instructions:
      'Vorlesen bei Kaffee und Kuchen im Bürgerhaus. Zeitungsartikel, Kurzgeschichten oder was die Gruppe gerade interessiert.',
    location: 'Bürgerhaus Eimsbüttel, Café',
    reimbursementTypeId: ehrenamtType?.id,
    inviteUserIds: [],
  });

  const deutschLernenDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(5) + 7,
  );
  const deutschLernenStart = fixtureWallClockToUtc(
    deutschLernenDay.year,
    deutschLernenDay.month,
    deutschLernenDay.day,
    16,
    30,
  );

  // "Deutsch lernen beim Vorlesen": Einzeltermin kommende Woche, offen für
  // alle, aber mit Freigabeprozess (joinRequiresApproval) — eine Person
  // wartet bereits auf Zusage. Zeigt "Freigabe" auch außerhalb von Süd.
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Deutsch lernen beim Vorlesen',
    startsAt: deutschLernenStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 90,
    visibility: ShiftVisibility.ALL_MEMBERS,
    joinRequiresApproval: true,
    maxVolunteers: 3,
    instructions:
      'Einfache Texte und Bilderbücher zum lauten Vorlesen und Nachsprechen, für Familien und Erwachsene, die neu Deutsch lernen. Zweisprachige Bücher sind willkommen.',
    location: 'Familienzentrum Schnelsen, Gruppenraum',
    imageUrl: DEUTSCH_LERNEN_IMAGE_URL,
    reimbursementTypeId: uebungsleiterType?.id,
    inviteUserIds: nordMembers.slice(2, 3).map((member) => member.id),
    extraInvites: nordMembers[0]
      ? [
          {
            userIds: [nordMembers[0].id],
            status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
          },
        ]
      : [],
  });

  // Anchored to THIS week's Thursday (not the past) so the biweekly pattern
  // is deterministic: occurrence 0 falls in the current week, the next one
  // two weeks later — i.e. it does NOT appear next week, by design.
  const buecherbusDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(4),
  );
  const buecherbusStart = fixtureWallClockToUtc(
    buecherbusDay.year,
    buecherbusDay.month,
    buecherbusDay.day,
    16,
  );

  // "Bücherbus-Vorlesestunde Stellingen": zweiwöchentlich statt wöchentlich —
  // zeigt ein anderes Wiederholungsmuster als die übrigen Einsätze.
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Bücherbus-Vorlesestunde Stellingen',
    startsAt: buecherbusStart,
    rrule: BIWEEKLY_THURSDAY_RRULE,
    durationMinutes: 60,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 3,
    instructions:
      'Vorlesen für Kinder und Familien, während der Bücherbus an seiner Haltestelle steht. Findet alle zwei Wochen statt.',
    location: 'Bücherbus-Haltestelle Stellingen, Kieler Straße',
    imageUrl: BUECHERBUS_IMAGE_URL,
    reimbursementTypeId: ehrenamtType?.id,
    inviteUserIds: nordMembers.slice(0, 1).map((member) => member.id),
  });

  const ferienlesestundeDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(2),
  );
  const ferienlesestundeStart = fixtureWallClockToUtc(
    ferienlesestundeDay.year,
    ferienlesestundeDay.month,
    ferienlesestundeDay.day,
    10,
  );

  // "Ferienlesestunde im Stadtpark": Einzeltermin, direkt eingeladen, bewusst
  // am selben Tag wie "Lesen im Park" (nur morgens statt nachmittags) — zeigt,
  // dass an einem Tag auch mehrere Einsätze stattfinden können.
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Ferienlesestunde im Stadtpark',
    startsAt: ferienlesestundeStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 60,
    visibility: ShiftVisibility.INVITED_MEMBERS,
    maxVolunteers: 2,
    instructions:
      'Zusätzlicher Vorlesetermin in den Ferien, morgens vor dem regulären "Lesen im Park". Gleicher Treffpunkt.',
    location: 'Altonaer Volkspark, Haupteingang Kieler Straße',
    inviteUserIds: nordMembers[3] ? [nordMembers[3].id] : [],
  });

  const buecherhalleDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(3) + 7,
  );
  const buecherhalleStart = fixtureWallClockToUtc(
    buecherhalleDay.year,
    buecherhalleDay.month,
    buecherhalleDay.day,
    16,
  );

  // "Vorlesestunde Bücherhalle Eimsbüttel": Einzeltermin kommende Woche,
  // komplett offen — niemand vorab eingeladen, keine Warteliste, keine
  // Freigabe nötig. Ohne Bild.
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Vorlesestunde Bücherhalle Eimsbüttel',
    startsAt: buecherhalleStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 60,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 2,
    instructions:
      'Spontaner Vorlesetermin in der Bücherhalle, offen für alle Ehrenamtlichen ohne Voranmeldung.',
    location: 'Bücherhalle Eimsbüttel',
    inviteUserIds: [],
  });

  // Anchored to THIS week's Saturday (starts now, not already in progress) so
  // it deterministically shows up once this week and once next week.
  const familienzentrumSeriesDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    daysUntilWeekday(6),
  );
  const familienzentrumSeriesStart = fixtureWallClockToUtc(
    familienzentrumSeriesDay.year,
    familienzentrumSeriesDay.month,
    familienzentrumSeriesDay.day,
    11,
  );

  // "Vorlesenachmittag Familienzentrum Schnelsen": befristete Reihe mit
  // sechs Terminen (statt unbegrenzt wöchentlich) — ohne Bild.
  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Vorlesenachmittag Familienzentrum Schnelsen',
    startsAt: familienzentrumSeriesStart,
    rrule: SATURDAY_SIX_WEEKS_RRULE,
    durationMinutes: 75,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 2,
    instructions:
      'Sechsteilige Vorlesereihe für Familien mit kleinen Kindern, thematisch rund um Jahreszeiten. Nach dem sechsten Termin endet die Reihe.',
    location: 'Familienzentrum Schnelsen, Spielraum',
    reimbursementTypeId: ehrenamtType?.id,
    inviteUserIds: nordMembers.slice(0, 2).map((member) => member.id),
  });

  // ─── Weitere Einzeltermine für Lesepaten Nord, damit diese und die
  // kommende Woche insgesamt so aussehen wie ein echter, gut gefüllter
  // Vereinskalender: 12 Einsätze diese Woche, 8 in der nächsten — darunter
  // unterbesetzte, voll besetzte und Einsätze mit Warteschlange. Über ein
  // Array statt einzelner Blöcke, weil es sonst zu unübersichtlich würde. ───

  type NordFillerShift = {
    title: string;
    dayOffset: number;
    hour: number;
    durationMinutes: number;
    visibility: ShiftVisibility;
    maxVolunteers: number;
    instructions: string;
    location: string;
    joinedIds: string[];
    waitlistIds?: string[];
    reimbursementTypeId?: string;
  };

  const nordFillerShifts: NordFillerShift[] = [
    // ── Diese Woche (6 zusätzliche, macht zusammen mit den 6 Terminen oben
    // 12 Einsätze diese Woche) ──
    {
      title: 'Vorlesestunde Seniorentreff Schnelsen',
      dayOffset: daysUntilWeekday(1),
      hour: 16,
      durationMinutes: 60,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 3,
      instructions:
        'Vorlesen und Austausch beim Seniorentreff im Familienzentrum Schnelsen.',
      location: 'Familienzentrum Schnelsen, Seniorentreff',
      joinedIds: nordMembers.slice(0, 3).map((member) => member.id), // voll besetzt
    },
    {
      title: 'Elternlesekreis Kita Sonnenschein',
      dayOffset: daysUntilWeekday(3),
      hour: 18,
      durationMinutes: 60,
      visibility: ShiftVisibility.INVITED_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Abendtermin für Eltern der Kita Sonnenschein: gemeinsam vorlesen und über Leseförderung austauschen.',
      location: 'Kita Sonnenschein, Elternraum',
      joinedIds: nordMembers[3] ? [nordMembers[3].id] : [], // unterbesetzt
      reimbursementTypeId: uebungsleiterType?.id,
    },
    {
      title: 'Vorlesepause Bücherhalle Stellingen',
      dayOffset: daysUntilWeekday(4),
      hour: 12,
      durationMinutes: 45,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Kurze Vorlesepause in der Mittagszeit für Kita-Gruppen, die die Bücherhalle besuchen.',
      location: 'Bücherhalle Stellingen',
      joinedIds: nordMembers.slice(1, 3).map((member) => member.id), // voll besetzt
    },
    {
      title: 'Lesestunde Familienzentrum Schnelsen (Zusatztermin)',
      dayOffset: daysUntilWeekday(5),
      hour: 15,
      durationMinutes: 60,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Zusätzlicher Vorlesetermin im Familienzentrum, sehr gefragt bei Eltern mit Kleinkindern.',
      location: 'Familienzentrum Schnelsen, Spielraum',
      joinedIds: [nordMembers[0], nordMembers[3]]
        .filter((member) => Boolean(member))
        .map((member) => member.id), // voll besetzt
      waitlistIds: nordMembers[1] ? [nordMembers[1].id] : [], // + Warteschlange
    },
    {
      title: 'Kinderlesekreis Bücherhalle Eimsbüttel',
      dayOffset: daysUntilWeekday(6),
      hour: 11,
      durationMinutes: 60,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 3,
      instructions:
        'Offener Lesekreis für Grundschulkinder, keine Anmeldung nötig.',
      location: 'Bücherhalle Eimsbüttel',
      joinedIds: [], // unterbesetzt, komplett offen
    },
    {
      title: 'Bücherkiste packen für Kinderhort',
      dayOffset: daysUntilWeekday(0),
      hour: 10,
      durationMinutes: 45,
      visibility: ShiftVisibility.INVITED_MEMBERS,
      maxVolunteers: 1,
      instructions:
        'Bücherkiste für den nächsten Kinderhort-Besuch zusammenstellen und vorbereiten.',
      location: 'Vereinsbüro Lesepaten Nord',
      joinedIds: [supervisor.id], // voll besetzt
    },
    // ── Nächste Woche (3 zusätzliche, macht zusammen mit den 5 Terminen
    // oben 8 Einsätze in der Folgewoche) ──
    {
      title: 'Vorlesestunde Seniorenresidenz Schnelsen',
      dayOffset: daysUntilWeekday(4) + 7,
      hour: 15,
      durationMinutes: 60,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Vorlesen für Bewohner:innen der Seniorenresidenz, in Kleingruppen.',
      location: 'Seniorenresidenz Schnelsen',
      joinedIds: nordMembers.slice(0, 2).map((member) => member.id), // voll besetzt
    },
    {
      title: 'Ferienlesestunde im Stadtpark (Zusatztermin)',
      dayOffset: daysUntilWeekday(2) + 7,
      hour: 10,
      durationMinutes: 60,
      visibility: ShiftVisibility.INVITED_MEMBERS,
      maxVolunteers: 2,
      instructions:
        'Zweiter Zusatztermin der Ferienlesestunde, gleicher Treffpunkt wie in der Vorwoche.',
      location: 'Altonaer Volkspark, Haupteingang Kieler Straße',
      joinedIds: nordMembers.slice(2, 4).map((member) => member.id), // voll besetzt
    },
    {
      title: 'Spontane Vorlesestunde Bücherschrank',
      dayOffset: daysUntilWeekday(1) + 7,
      hour: 17,
      durationMinutes: 30,
      visibility: ShiftVisibility.ALL_MEMBERS,
      maxVolunteers: 3,
      instructions:
        'Spontaner Kurztermin am öffentlichen Bücherschrank, offen für alle.',
      location: 'Bücherschrank Kieler Straße',
      joinedIds: nordMembers[0] ? [nordMembers[0].id] : [], // unterbesetzt
    },
  ];

  for (const fillerShift of nordFillerShifts) {
    const fillerDay = addDaysInFixtureTimezone(
      today.year,
      today.month,
      today.day,
      fillerShift.dayOffset,
    );
    const fillerStart = fixtureWallClockToUtc(
      fillerDay.year,
      fillerDay.month,
      fillerDay.day,
      fillerShift.hour,
    );

    await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
      title: fillerShift.title,
      startsAt: fillerStart,
      rrule: ONE_TIME_RRULE,
      durationMinutes: fillerShift.durationMinutes,
      visibility: fillerShift.visibility,
      maxVolunteers: fillerShift.maxVolunteers,
      instructions: fillerShift.instructions,
      location: fillerShift.location,
      reimbursementTypeId: fillerShift.reimbursementTypeId,
      inviteUserIds: fillerShift.joinedIds,
      extraInvites: fillerShift.waitlistIds?.length
        ? [
            {
              userIds: fillerShift.waitlistIds,
              status: ShiftInviteStatus.WAITLIST_JOINED,
            },
          ]
        : [],
    });
  }

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

  // Events leben bei Lesepaten Nord (statt org-weit auf Vereinsebene), damit
  // sie direkt in der Nord-Ansicht auftauchen.
  const lesesommer = await ensureEvent(db, org.unitIds.nord, coordinator.id, {
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
  const lesefest = await ensureEvent(db, org.unitIds.nord, coordinator.id, {
    title: 'Lesefest',
    description:
      'Eintägiges Straßenfest zum Abschluss des Lesesommers: Lesungen, Bücherflohmarkt und ein Programm für Kinder.',
    location: 'Platz der Republik, Hamburg-Altona',
    coverUrl: LESEFEST_COVER_IMAGE_URL,
    startsAt: lesefestStart,
    endsAt: addHours(lesefestStart, 6),
  });

  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
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

  // "Vorlesewettbewerb": einmaliges Event für Kinder, mit einem
  // Betreuungs-Einsatz in Lesepaten Nord.
  const vorlesewettbewerbDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    30,
  );
  const vorlesewettbewerbStart = fixtureWallClockToUtc(
    vorlesewettbewerbDay.year,
    vorlesewettbewerbDay.month,
    vorlesewettbewerbDay.day,
    14,
  );
  const vorlesewettbewerb = await ensureEvent(
    db,
    org.unitIds.nord,
    coordinator.id,
    {
      title: 'Vorlesewettbewerb',
      description:
        'Kinder aus Altonaer Grundschulen lesen vor einer kleinen Jury aus ihrem Lieblingsbuch vor. Am Ende gibt es für alle eine Urkunde.',
      location: 'Bücherhalle Eimsbüttel, Veranstaltungssaal',
      coverUrl: VORLESEWETTBEWERB_IMAGE_URL,
      startsAt: vorlesewettbewerbStart,
      endsAt: addHours(vorlesewettbewerbStart, 3),
    },
  );

  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Jury & Betreuung Vorlesewettbewerb',
    startsAt: vorlesewettbewerbStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 180,
    visibility: ShiftVisibility.ALL_MEMBERS,
    maxVolunteers: 3,
    instructions:
      'Jurymitglied sein oder beim Empfang und der Kinderbetreuung am Rand des Wettbewerbs helfen.',
    location: 'Bücherhalle Eimsbüttel, Veranstaltungssaal',
    eventId: vorlesewettbewerb.id,
    inviteUserIds: nordMembers.slice(1, 3).map((member) => member.id),
  });

  // "Interkultureller Lesetag": einmaliges Event, Geschichten und
  // zweisprachige Bücher aus vielen Herkunftsländern.
  const interkulturellerLesetagDay = addDaysInFixtureTimezone(
    today.year,
    today.month,
    today.day,
    60,
  );
  const interkulturellerLesetagStart = fixtureWallClockToUtc(
    interkulturellerLesetagDay.year,
    interkulturellerLesetagDay.month,
    interkulturellerLesetagDay.day,
    12,
  );
  const interkulturellerLesetag = await ensureEvent(
    db,
    org.unitIds.nord,
    coordinator.id,
    {
      title: 'Interkultureller Lesetag',
      description:
        'Geschichten und zweisprachige Bücher aus vielen Herkunftsländern — zum Vorlesen, Zuhören und gemeinsamen Entdecken, für die ganze Familie.',
      location: 'Familienzentrum Schnelsen',
      coverUrl: INTERKULTURELLER_LESETAG_IMAGE_URL,
      startsAt: interkulturellerLesetagStart,
      endsAt: addHours(interkulturellerLesetagStart, 6),
    },
  );

  await ensureShiftWithInvites(db, org.unitIds.nord, coordinator.id, {
    title: 'Standbetreuung Interkultureller Lesetag',
    startsAt: interkulturellerLesetagStart,
    rrule: ONE_TIME_RRULE,
    durationMinutes: 360,
    visibility: ShiftVisibility.ALL_MEMBERS,
    instructions:
      'Empfang, Ausleihe der zweisprachigen Bücher und Ansprechpartner:in für Familien den ganzen Nachmittag über.',
    location: 'Familienzentrum Schnelsen',
    eventId: interkulturellerLesetag.id,
    inviteUserIds: nordMembers.slice(0, 2).map((member) => member.id),
    pendingInviteUserIds: [demoUser.id],
  });

  // ─── Zeiterfassung (Use Case 3), getrennt nach Pauschalenart (Use Case 4) ───
  // (ehrenamtType/uebungsleiterType wurden bereits oben aufgelöst, direkt nach
  // dem Anlegen der Organisation, damit auch Einsätze weiter oben schon mit
  // reimbursementTypeId getaggt werden konnten.)

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

  // ─── Weitere Zeiterfassung: Abrechnungs-Demo für Lena Vogt (August) plus
  // ca. 20 weitere Einträge anderer Freiwilliger, überwiegend mit
  // Pauschalenart. Nicht an konkrete Schicht-Instanzen gekoppelt
  // (shiftInstanceId bleibt leer) — das Datenmodell erlaubt das explizit für
  // manuell nacherfasste Zeiten, und es macht die Platzierung unabhängig von
  // den tatsächlich generierten RRULE-Terminen. Einmalig über einen Check auf
  // Lenas Zeiterfassung abgesichert, damit ein erneuter Lauf nichts
  // verdoppelt. ───

  const lenaHasTimeEntries = ehrenamtType
    ? await db.query.timeEntries.findFirst({
        where: { volunteerId: demoUser.id },
      })
    : null;

  if (ehrenamtType && uebungsleiterType && !lenaHasTimeEntries) {
    // August des Vorjahresmonats, der zuletzt vergangen ist — robust
    // unabhängig davon, wann dieses Skript im Jahr läuft.
    const augustYear = today.month > 8 ? today.year : today.year - 1;

    const manualEntries: Array<typeof schema.timeEntries.$inferInsert> = [];

    const addManualEntry = (params: {
      volunteerId: string;
      organizationUnitId: string;
      reimbursementTypeId: string;
      year: number;
      month: number;
      day: number;
      hour: number;
      minute?: number;
      durationHours: number;
      notes: string;
    }): void => {
      const startedAt = fixtureWallClockToUtc(
        params.year,
        params.month,
        params.day,
        params.hour,
        params.minute ?? 0,
      );
      manualEntries.push({
        shiftInstanceId: null,
        organizationUnitId: params.organizationUnitId,
        volunteerId: params.volunteerId,
        reimbursementTypeId: params.reimbursementTypeId,
        startedAt,
        endedAt: addHours(startedAt, params.durationHours),
        notes: params.notes,
      });
    };

    // Lena Vogt: 4 Einsätze mit Übungsleiterpauschale im August, zum
    // Vorführen der Abrechnung auf ihrem Account.
    const lenaAugustDays = [4, 11, 18, 25];
    for (const [index, day] of lenaAugustDays.entries()) {
      addManualEntry({
        volunteerId: demoUser.id,
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        year: augustYear,
        month: 8,
        day,
        hour: index % 2 === 0 ? 9 : 16,
        minute: index % 2 === 0 ? 30 : 0,
        durationHours: 1.5,
        notes:
          index % 2 === 0
            ? 'Vorlesepatenschaft Kita Sonnenschein — für Abrechnung nacherfasst'
            : 'Deutsch lernen beim Vorlesen — für Abrechnung nacherfasst',
      });
    }

    // ~20 weitere Einträge anderer Freiwilliger, überwiegend mit
    // Pauschalenart, verteilt über die letzten Wochen.
    type OtherEntryFixture = {
      volunteer: FixtureUser;
      organizationUnitId: string;
      reimbursementTypeId: string;
      daysAgo: number;
      hour: number;
      minute?: number;
      durationHours: number;
      notes: string;
    };

    const otherEntries: OtherEntryFixture[] = [
      // Lesepaten Nord — Übungsleiterpauschale
      {
        volunteer: additionalNordMembers[0],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 7,
        hour: 9,
        minute: 30,
        durationHours: 1,
        notes: 'Vorlesepatenschaft Kita Sonnenschein — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[1],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 14,
        hour: 9,
        minute: 30,
        durationHours: 1,
        notes: 'Vorlesepatenschaft Kita Sonnenschein — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[2],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 21,
        hour: 9,
        minute: 30,
        durationHours: 1,
        notes: 'Vorlesepatenschaft Kita Sonnenschein — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[3],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 28,
        hour: 9,
        minute: 30,
        durationHours: 1,
        notes: 'Vorlesepatenschaft Kita Sonnenschein — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[4],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 10,
        hour: 16,
        minute: 30,
        durationHours: 1.5,
        notes: 'Deutsch lernen beim Vorlesen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[5],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 24,
        hour: 16,
        minute: 30,
        durationHours: 1.5,
        notes: 'Deutsch lernen beim Vorlesen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[13],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 5,
        hour: 16,
        minute: 30,
        durationHours: 1.5,
        notes: 'Deutsch lernen beim Vorlesen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[14],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 15,
        hour: 9,
        minute: 30,
        durationHours: 1,
        notes: 'Vorlesepatenschaft Kita Sonnenschein — nachträglich erfasst',
      },
      // Lesepaten Nord — Ehrenamtspauschale
      {
        volunteer: additionalNordMembers[6],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 3,
        hour: 15,
        minute: 30,
        durationHours: 1.5,
        notes: 'Lesecafé für Senior:innen Eimsbüttel — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[7],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 9,
        hour: 16,
        durationHours: 1,
        notes: 'Bücherbus-Vorlesestunde Stellingen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[8],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 13,
        hour: 11,
        durationHours: 1.25,
        notes:
          'Vorlesenachmittag Familienzentrum Schnelsen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[9],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 17,
        hour: 15,
        minute: 30,
        durationHours: 1.5,
        notes: 'Lesecafé für Senior:innen Eimsbüttel — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[10],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 20,
        hour: 16,
        durationHours: 1,
        notes: 'Bücherbus-Vorlesestunde Stellingen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[11],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 27,
        hour: 11,
        durationHours: 1.25,
        notes:
          'Vorlesenachmittag Familienzentrum Schnelsen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[12],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 31,
        hour: 15,
        minute: 30,
        durationHours: 1.5,
        notes: 'Lesecafé für Senior:innen Eimsbüttel — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[15],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 22,
        hour: 16,
        durationHours: 1,
        notes: 'Bücherbus-Vorlesestunde Stellingen — nachträglich erfasst',
      },
      {
        volunteer: additionalNordMembers[16],
        organizationUnitId: org.unitIds.nord,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 35,
        hour: 11,
        durationHours: 1.25,
        notes:
          'Vorlesenachmittag Familienzentrum Schnelsen — nachträglich erfasst',
      },
      // Lesepaten Süd — Ehrenamtspauschale
      {
        volunteer: suedMembers[3],
        organizationUnitId: org.unitIds.sued,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 4,
        hour: 14,
        durationHours: 2,
        notes: 'Seniorenkreis — nachträglich erfasst',
      },
      {
        volunteer: suedMembers[0],
        organizationUnitId: org.unitIds.sued,
        reimbursementTypeId: ehrenamtType.id,
        daysAgo: 11,
        hour: 16,
        durationHours: 1.5,
        notes: 'Lesen im Elisabethstift — nachträglich erfasst',
      },
      // Lesepaten West — Übungsleiterpauschale
      {
        volunteer: westMembers[2],
        organizationUnitId: org.unitIds.west,
        reimbursementTypeId: uebungsleiterType.id,
        daysAgo: 8,
        hour: 17,
        durationHours: 1.5,
        notes: 'Deutsche Literatur für Anfänger — nachträglich erfasst',
      },
    ];

    for (const entry of otherEntries) {
      if (!entry.volunteer) {
        continue;
      }
      const day = addDaysInFixtureTimezone(
        today.year,
        today.month,
        today.day,
        -entry.daysAgo,
      );
      addManualEntry({
        volunteerId: entry.volunteer.id,
        organizationUnitId: entry.organizationUnitId,
        reimbursementTypeId: entry.reimbursementTypeId,
        year: day.year,
        month: day.month,
        day: day.day,
        hour: entry.hour,
        minute: entry.minute,
        durationHours: entry.durationHours,
        notes: entry.notes,
      });
    }

    await db.insert(schema.timeEntries).values(manualEntries);
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
    'Lesepaten Nord: 12 Einsätze diese Woche, 8 in der Folgewoche — Mischung aus 4 Dauerserien (Kita montags, Park dienstags, Bücherbus alle 2 Wochen donnerstags, Familienzentrum-Reihe samstags über 6 Wochen) und Einzelterminen.',
  );
  console.log(
    'Lesepaten Nord — Besetzungsstatus: unterbesetzt u.a. Bücherbus, Lesecafé, Elternlesekreis, Kinderlesekreis, Deutsch lernen (+Freigabe ausstehend), Bücherschrank; voll besetzt u.a. Kita, Seniorentreff, Vorlesepause, Bücherkiste, Seniorenresidenz; mit Warteschlange: Lesen im Park, Lesestunde Familienzentrum (Zusatztermin).',
  );
  console.log(
    'Lesepaten Nord — Einladungsarten: direkt eingeladen (Kita, Ferienlesestunde x2, Elternlesekreis, Bücherkiste), offen ohne Anmeldung (Park, Bücherbus, Lesecafé, Kinderlesekreis, u.a.), offen mit Freigabe (Deutsch lernen).',
  );
  console.log(
    'Shifts (Süd/West): Lesen im Elisabethstift (direkt eingeladen), Seniorenkreis (Freigabe ausstehend), Deutsche Literatur für Anfänger',
  );
  console.log(
    'Events (jetzt bei Lesepaten Nord statt Vereinsebene): Lesesommer (mit Vorlesestunde im Stadtpark), Lesefest, Vorlesewettbewerb, Interkultureller Lesetag',
  );
  console.log(
    'Anforderungsformulare: Interessensbekundung + Vereinbarung zur ehrenamtlichen Mitarbeit (Verein), Erweitertes Führungszeugnis (Lesen im Park, Vorlesepatenschaft Kita Sonnenschein)',
  );
  console.log(
    'Mitgliedschaften: 2 ausstehend (Marie Albrecht, David Kern), 1 abgelehnt (Sabine Wolff)',
  );
  console.log(
    `Lesepaten Nord: 23 Freiwillige insgesamt (Hannah, Mehmet, Sophie, Lena + 19 weitere), eigenes Titelbild.`,
  );
  console.log(
    'Pauschalenart bei Einsätzen: Übungsleiterpauschale (Kita Sonnenschein, Deutsch lernen, Elternlesekreis), Ehrenamtspauschale (Lesecafé, Bücherbus, Familienzentrum-Reihe); alle anderen Einsätze ohne Pauschale.',
  );
  console.log(
    `Zeiterfassung: 4 Einträge mit Übungsleiterpauschale im August für ${demoUser.email} (Abrechnungs-Demo) plus rund 20 weitere Einträge anderer Freiwilliger.`,
  );

  await pool.end();
}

seedDemoFixtures().catch((error) => {
  console.error(error);
  process.exit(1);
});

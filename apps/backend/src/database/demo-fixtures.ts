/**
 * Realistic demo dataset ("Altonaer Lesepaten") for local development,
 * demos and manual testing.
 *
 * Fully fictional non-profit reading-mentorship organisation, built to look
 * like a real Caluno customer instead of the "demo+testing_memberNN" Testing e2e
 * seed. Creates its own organisation, accounts and shifts/events — so
 * re-running `bun run db:fixtures:e2e` (the Testing/e2e dataset) is
 * unaffected, and running this script never touches the Testing org.
 * Shared date/auth/shift helpers live in `fixture-helpers.ts`; the content
 * itself (forms, people, shifts, events, time entries) lives in
 * `demo-content.ts`, which `demo-fixtures-into-org.ts` also seeds into
 * arbitrary existing organizations.
 *
 * Usage (from apps/backend, after `bun bootstrap` or `bun run db:migrate` +
 * `bun run db:seed` have run at least once so permissions + reimbursement
 * types exist):
 *
 *   bun run db:fixtures:demo
 *
 * All accounts use the password from DEMO_FIXTURE_PASSWORD, default `abcd1234`.
 * All emails are on the `caluno.org` domain, plus-addressed onto the demo
 * group (`demo+owner@caluno.org`, `demo+member01@caluno.org`, …), so every
 * address routes to the single demo@caluno.org inbox.
 */
import { hashPassword } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { runFixtureSeed } from '../shared/observability/fixture-failure-reporter';
import { seedDemoAccounting } from './demo-accounting';
import {
  COORDINATOR,
  DEMO_REGIONS,
  type DemoEmails,
  NORD_COVER_IMAGE_URL,
  PORTRAIT_URLS,
  planDemoAccounts,
  SUPERVISOR_PERMISSIONS,
  SUPERVISOR_ROLE_NAME,
  seedDemoContent,
} from './demo-content';
import {
  type DemoOrganizationConfig,
  ensureDemoOrganization,
} from './demo-organization';
import {
  assertFixtureIdentitiesAvailable,
  createAuthUser,
  fixtureOrgId,
} from './fixture-helpers';
import { relations } from './relations';

process.env.TZ = 'Europe/Berlin';

const FIXTURE_PASSWORD = process.env.DEMO_FIXTURE_PASSWORD ?? 'abcd1234';
const ORG_NAME = 'Altonaer Lesepaten';
/**
 * `demo-` prefixed so a real customer can never take this slug: these fixtures
 * seed into real environments, and a slug clash would abort the seed on every
 * deploy.
 */
const ORG_SLUG = 'demo-altonaer-lesepaten';
/** Pinned id — fixture ownership is proven by id, never by name or slug. */
const ORG_ID = fixtureOrgId(ORG_SLUG);
const ORG_DESCRIPTION =
  'Gemeinnütziger Verein: Ehrenamtliche begleiten Kinder, Senior:innen und Menschen mit Leseschwierigkeiten in Hamburg-Altona beim Lesen.';
const EMAIL_DOMAIN = 'caluno.org';
/** Local part of the plus-addressed demo-group address: `demo+<role>@caluno.org`. */
const emailLocalPart = (role: string) => `demo+${role}`;
/** The demo group address itself — the primary demo login. */
const DEMO_ACCOUNT_EMAIL = `demo@${EMAIL_DOMAIN}`;

// Unsplash photo; see `demo-content.ts` for the other images and credits.
const ORG_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1776015625774-f7f7d1b55f79?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'; // Boris Dobretsov — person on a park bench among trees

// ─── Organisation + org units ───

/**
 * The demo organization's identity and regional structure, shared by creation
 * and repair. Unit ids are derived from the region slugs, so they stay stable
 * across runs.
 */
const DEMO_ORGANIZATION: DemoOrganizationConfig = {
  orgId: ORG_ID,
  orgSlug: ORG_SLUG,
  orgName: ORG_NAME,
  orgDescription: ORG_DESCRIPTION,
  contactEmail: DEMO_ACCOUNT_EMAIL,
  rootCoverImageUrl: ORG_COVER_IMAGE_URL,
  northCoverImageUrl: NORD_COVER_IMAGE_URL,
  supervisorRoleName: SUPERVISOR_ROLE_NAME,
  supervisorPermissions: SUPERVISOR_PERMISSIONS,
  regions: DEMO_REGIONS.map((region) => ({
    key: region.key,
    name: `Lesepaten ${region.nameSuffix}`,
    slug: `${ORG_SLUG}-${region.key}`,
    description: region.description,
  })),
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

  const emails: DemoEmails = {
    role: (role) => `${emailLocalPart(role)}@${EMAIL_DOMAIN}`,
    demoAccount: DEMO_ACCOUNT_EMAIL,
  };

  // Every identity these fixtures claim is declared before the first write, so
  // the pre-flight below can verify all of them against the live database.
  await assertFixtureIdentitiesAvailable(db, {
    orgSlug: ORG_SLUG,
    unitSlugs: [
      ORG_SLUG,
      ...DEMO_ORGANIZATION.regions.map((region) => region.slug),
    ],
    accounts: planDemoAccounts(emails),
  });

  const coordinator = await createAuthUser(db, hashedPassword, {
    locale: 'de',
    email: emails.role('owner'),
    ...COORDINATOR,
    image: PORTRAIT_URLS['friederike.lange'],
  });

  const org = await ensureDemoOrganization(
    db,
    coordinator.id,
    DEMO_ORGANIZATION,
  );

  const demoUser = await seedDemoContent(db, {
    org,
    coordinator,
    emails,
    createUser: (input) => createAuthUser(db, hashedPassword, input),
  });

  await seedDemoAccounting(db, {
    org,
    coordinatorId: coordinator.id,
    memberEmail: (index) =>
      emails.role(`member${String(index).padStart(2, '0')}`),
  });

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

  await pool.end();
}

void runFixtureSeed('demo', seedDemoFixtures);

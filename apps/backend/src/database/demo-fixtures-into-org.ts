/**
 * Seeds the "Altonaer Lesepaten" demo content (see `demo-content.ts`) into an
 * existing organization — e.g. to give a prospect's trial org realistic data.
 *
 * Unlike `demo-fixtures.ts` this is a manual one-off: it never runs on deploy,
 * uses random ids and does not pin identities. It adds three sub-units below
 * the org's root unit, named like the root unit plus " Nord", " Süd" and
 * " West", and a dedicated set of demo accounts. Nothing existing is modified,
 * except that accounting is switched on for the organization.
 *
 * Re-running it against the same organization reuses the sub-units (by name),
 * accounts (by address), shifts, events and forms (by title/slug) it created
 * before.
 *
 * Usage (from apps/backend, after `bun run db:seed` so permissions and
 * reimbursement types exist):
 *
 *   bun run db:fixtures:demo:into-org <organization-id-or-slug | root-unit-id>
 *
 * Given an organization, the sub-units go below its (oldest) root unit; given
 * a root unit id, below that unit.
 *
 * Accounts are plus-addressed onto the demo group, discriminated by the org
 * slug: `demo+<slug>@caluno.org` (demo volunteer), `demo+<slug>-owner@…`,
 * `demo+<slug>-member01@…`, … All use the password from
 * DEMO_FIXTURE_PASSWORD, default `abcd1234`.
 */
import { hashPassword } from 'better-auth/crypto';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
} from '../auth/constants';
import { permissions } from '../auth/schemas/permission.schema';
import { runFixtureSeed } from '../shared/observability/fixture-failure-reporter';
import {
  COORDINATOR,
  DEMO_REGIONS,
  type DemoEmails,
  NORD_COVER_IMAGE_URL,
  PORTRAIT_URLS,
  SUPERVISOR_PERMISSIONS,
  SUPERVISOR_ROLE_NAME,
  seedDemoContent,
} from './demo-content';
import type { DemoRegionKey } from './demo-organization';
import {
  type AuthUserInput,
  type Database,
  ensureMembershipWithRole,
  type FixtureUser,
  insertAuthUser,
} from './fixture-helpers';
import { relations } from './relations';
import * as schema from './schema';

process.env.TZ = 'Europe/Berlin';

const FIXTURE_PASSWORD = process.env.DEMO_FIXTURE_PASSWORD ?? 'abcd1234';
const EMAIL_DOMAIN = 'caluno.org';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UnitRow = typeof schema.organizationUnits.$inferSelect;

/**
 * Resolves the target from an organization id or slug (seeding below its
 * oldest root unit) or from the id of a root unit (seeding below that one).
 */
const resolveTarget = async (db: Database, identifier: string) => {
  const isUuid = UUID_RE.test(identifier);

  const organization = isUuid
    ? await db.query.organizations.findFirst({ where: { id: identifier } })
    : await db.query.organizations.findFirst({ where: { slug: identifier } });

  if (organization) {
    const rootUnit = await db.query.organizationUnits.findFirst({
      where: {
        organizationId: organization.id,
        parentId: { isNull: true },
        deletedAt: { isNull: true },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!rootUnit) {
      throw new Error(`Organization "${organization.slug}" has no root unit`);
    }
    return { organization, rootUnit };
  }

  const rootUnit = isUuid
    ? await db.query.organizationUnits.findFirst({
        where: { id: identifier, deletedAt: { isNull: true } },
      })
    : undefined;

  if (!rootUnit) {
    throw new Error(`No organization or root unit found for "${identifier}"`);
  }
  if (rootUnit.parentId !== null) {
    throw new Error(
      `Unit "${rootUnit.name}" (${rootUnit.id}) is not a root unit — pass the id of a root unit or of its organization`,
    );
  }

  const unitOrganization = await db.query.organizations.findFirst({
    where: { id: rootUnit.organizationId },
  });
  if (!unitOrganization) {
    throw new Error(`Organization of unit ${rootUnit.id} not found`);
  }

  return { organization: unitOrganization, rootUnit };
};

const ensureSupervisorRole = async (
  db: Database,
  organization: typeof schema.organizations.$inferSelect,
): Promise<string> => {
  const existing = await db.query.roles.findFirst({
    where: { organizationId: organization.id, name: SUPERVISOR_ROLE_NAME },
  });
  if (existing) {
    return existing.id;
  }

  const [role] = await db
    .insert(schema.roles)
    .values({
      name: SUPERVISOR_ROLE_NAME,
      description: `Supervisor role for organization ${organization.name}`,
      isInternal: false,
      organizationId: organization.id,
    })
    .returning();

  if (!role) {
    throw new Error('Failed to create supervisor role');
  }

  const permissionRows = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.key, [...SUPERVISOR_PERMISSIONS]));

  if (permissionRows.length > 0) {
    await db.insert(schema.rolePermissions).values(
      permissionRows.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    );
  }

  return role.id;
};

/**
 * Finds the sub-unit by name below the root unit or creates it. Unit slugs
 * are globally unique, so a taken slug gets a random suffix.
 */
const ensureRegionUnit = async (
  db: Database,
  rootUnit: UnitRow,
  region: (typeof DEMO_REGIONS)[number],
): Promise<string> => {
  const name = `${rootUnit.name} ${region.nameSuffix}`;

  const existing = await db.query.organizationUnits.findFirst({
    where: { parentId: rootUnit.id, name, deletedAt: { isNull: true } },
  });
  if (existing) {
    return existing.id;
  }

  let slug = `${rootUnit.slug}-${region.key}`;
  if (await db.query.organizationUnits.findFirst({ where: { slug } })) {
    slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
  }

  const [unit] = await db
    .insert(schema.organizationUnits)
    .values({
      organizationId: rootUnit.organizationId,
      parentId: rootUnit.id,
      typeId: rootUnit.typeId,
      name,
      slug,
      contactEmail: rootUnit.contactEmail,
      description: region.description,
      coverUrl: region.key === 'nord' ? NORD_COVER_IMAGE_URL : null,
      street: rootUnit.street,
      zipCode: rootUnit.zipCode,
      city: rootUnit.city,
    })
    .returning();

  if (!unit) {
    throw new Error(`Failed to create organization unit: ${name}`);
  }

  return unit.id;
};

async function seedDemoFixturesIntoOrg() {
  const identifier = process.argv[2];
  if (!identifier) {
    throw new Error(
      'Usage: bun run db:fixtures:demo:into-org <organization-id-or-slug | root-unit-id>',
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

  const hashedPassword = await hashPassword(FIXTURE_PASSWORD);

  // One transaction: a failed run leaves the organization untouched.
  const result = await drizzle({ client: pool, relations }).transaction(
    async (db) => {
      const { organization, rootUnit } = await resolveTarget(db, identifier);

      const roles = await db.query.roles.findMany({
        where: { organizationId: organization.id },
      });
      const ownerRole = roles.find(
        (role) => role.name === DEFAULT_OWNER_ROLE_NAME,
      );
      const memberRole = roles.find(
        (role) => role.name === DEFAULT_MEMBER_ROLE_NAME,
      );
      if (!ownerRole || !memberRole) {
        throw new Error(
          `Organization "${organization.slug}" is missing its owner or member role`,
        );
      }

      const supervisorRoleId = await ensureSupervisorRole(db, organization);

      const unitIds = {} as Record<DemoRegionKey, string>;
      for (const region of DEMO_REGIONS) {
        unitIds[region.key] = await ensureRegionUnit(db, rootUnit, region);
      }

      const emails: DemoEmails = {
        role: (role) => `demo+${organization.slug}-${role}@${EMAIL_DOMAIN}`,
        demoAccount: `demo+${organization.slug}@${EMAIL_DOMAIN}`,
      };

      const createUser = async (input: AuthUserInput): Promise<FixtureUser> => {
        const existing = await db.query.users.findFirst({
          where: { email: input.email },
        });
        if (existing) {
          return existing;
        }
        return insertAuthUser(db, crypto.randomUUID(), hashedPassword, input);
      };

      const coordinator = await createUser({
        locale: 'de',
        email: emails.role('owner'),
        ...COORDINATOR,
        image: PORTRAIT_URLS['friederike.lange'],
      });
      await ensureMembershipWithRole(
        db,
        coordinator.id,
        rootUnit.id,
        ownerRole.id,
      );

      const demoUser = await seedDemoContent(db, {
        org: {
          organizationId: organization.id,
          rootUnitId: rootUnit.id,
          unitIds,
          memberRoleId: memberRole.id,
          supervisorRoleId,
        },
        coordinator,
        emails,
        createUser,
      });

      return { organization, rootUnit, unitIds, coordinator, demoUser };
    },
  );

  const { organization, rootUnit, unitIds, coordinator, demoUser } = result;
  console.log(
    `Seeded demo content into ${organization.name} (${organization.id})`,
  );
  console.log(
    `Units: ${DEMO_REGIONS.map((region) => `${rootUnit.name} ${region.nameSuffix} (${unitIds[region.key]})`).join(', ')}`,
  );
  console.log(
    `Login (Koordinatorin): ${coordinator.email} / ${FIXTURE_PASSWORD}`,
  );
  console.log(
    `Login (Demo-Ehrenamtliche für Screens): ${demoUser.email} / ${FIXTURE_PASSWORD}`,
  );

  await pool.end();
}

void runFixtureSeed('demo', seedDemoFixturesIntoOrg);

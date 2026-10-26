import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  type DemoOrganizationConfig,
  ensureDemoOrganization,
} from '../src/database/demo-organization';
import {
  assertFixtureIdentitiesAvailable,
  type Database,
  fixtureOrgId,
  fixtureOrgUnitId,
} from '../src/database/fixture-helpers';
import { relations } from '../src/database/relations';
import * as schema from '../src/database/schema';

const ORG_ID = '6f0c2f56-7f0a-4c53-9a8d-2b1e3c4d5e6f';
const ORG_SLUG = 'test-demo-reading-friends';
const ADMIN_USER_ID = 'test-demo-admin';
const SUPERVISOR_ROLE = 'Koordinator:in vor Ort';

const REGIONS = [
  {
    key: 'nord',
    name: 'Lesepaten Nord',
    slug: `${ORG_SLUG}-nord`,
    description: 'North',
  },
  {
    key: 'sued',
    name: 'Lesepaten Süd',
    slug: `${ORG_SLUG}-sued`,
    description: 'South',
  },
  {
    key: 'west',
    name: 'Lesepaten West',
    slug: `${ORG_SLUG}-west`,
    description: 'West',
  },
] as const;

const CONFIG: DemoOrganizationConfig = {
  orgId: ORG_ID,
  orgSlug: ORG_SLUG,
  orgName: 'Test Lesepaten',
  orgDescription: 'Test fixture organization',
  contactEmail: 'demo@example.com',
  rootCoverImageUrl: 'https://example.com/root.jpg',
  northCoverImageUrl: 'https://example.com/north.jpg',
  supervisorRoleName: SUPERVISOR_ROLE,
  supervisorPermissions: [],
  regions: REGIONS,
};

const rootUnitId = fixtureOrgUnitId(ORG_SLUG);
const pinnedId = (slug: string) => fixtureOrgUnitId(slug);

let pool: Pool;
let db: Database;

const findUnit = (slug: string) =>
  db.query.organizationUnits.findFirst({
    where: { organizationId: ORG_ID, slug },
  });

beforeAll(async () => {
  if (!process.env.DB_NAME?.includes('_test_')) {
    throw new Error(
      'Refusing to run demo-organization integration tests against a non-test database',
    );
  }

  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });
  db = drizzle({ client: pool, relations });

  await db.insert(schema.users).values({
    id: ADMIN_USER_ID,
    name: 'Test Admin',
    email: 'test-demo-admin@example.com',
    firstname: 'Test',
    lastname: 'Admin',
  });
});

afterAll(async () => {
  await pool.end();
});

describe('ensureDemoOrganization', () => {
  it('creates the organization with pinned unit ids', async () => {
    const handles = await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    expect(handles.rootUnitId).toBe(rootUnitId);
    for (const region of REGIONS) {
      expect(handles.unitIds[region.key]).toBe(pinnedId(region.slug));
    }

    const units = await db.query.organizationUnits.findMany({
      where: { organizationId: ORG_ID },
    });
    expect(units).toHaveLength(4);
  });

  it('is idempotent on a healthy organization', async () => {
    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    const units = await db.query.organizationUnits.findMany({
      where: { organizationId: ORG_ID },
    });
    expect(units).toHaveLength(4);
    for (const region of REGIONS) {
      expect((await findUnit(region.slug))?.name).toBe(region.name);
    }
  });

  it('restores the expected name of a renamed unit', async () => {
    const [region] = REGIONS;
    await db
      .update(schema.organizationUnits)
      .set({ name: 'Renamed by an admin' })
      .where(eq(schema.organizationUnits.id, pinnedId(region.slug)));

    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    expect((await findUnit(region.slug))?.name).toBe(region.name);
  });

  it('revives a soft-deleted unit', async () => {
    const [region] = REGIONS;
    await db
      .update(schema.organizationUnits)
      .set({ deletedAt: new Date() })
      .where(eq(schema.organizationUnits.id, pinnedId(region.slug)));

    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    expect((await findUnit(region.slug))?.deletedAt).toBeNull();
  });

  it('recreates a deleted unit with its pinned id', async () => {
    const [region] = REGIONS;
    await db
      .delete(schema.organizationUnits)
      .where(eq(schema.organizationUnits.id, pinnedId(region.slug)));

    const handles = await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    expect(handles.unitIds[region.key]).toBe(pinnedId(region.slug));
    expect((await findUnit(region.slug))?.id).toBe(pinnedId(region.slug));
  });

  it('recreates a deleted root unit and its regions', async () => {
    await db
      .delete(schema.organizationUnits)
      .where(eq(schema.organizationUnits.organizationId, ORG_ID));

    const handles = await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    expect(handles.rootUnitId).toBe(rootUnitId);
    expect((await findUnit(ORG_SLUG))?.id).toBe(rootUnitId);
    for (const region of REGIONS) {
      expect((await findUnit(region.slug))?.id).toBe(pinnedId(region.slug));
    }
  });

  it('restores the parent and type of a re-parented, retyped unit', async () => {
    const [nord, sued] = REGIONS;
    const types = await db.query.organizationUnitTypes.findMany({
      where: { organizationId: ORG_ID },
    });
    const rootType = types.find((type) => type.name === 'Verein');
    const regionType = types.find((type) => type.name === 'Regionalgruppe');
    if (!rootType || !regionType) {
      throw new Error('Expected both demo unit types to exist');
    }

    await db
      .update(schema.organizationUnits)
      .set({ parentId: pinnedId(sued.slug), typeId: rootType.id })
      .where(eq(schema.organizationUnits.id, pinnedId(nord.slug)));

    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    const healed = await findUnit(nord.slug);
    expect(healed?.parentId).toBe(rootUnitId);
    expect(healed?.typeId).toBe(regionType.id);
  });

  it('leaves admin-editable content of a unit alone', async () => {
    const [region] = REGIONS;
    await db
      .update(schema.organizationUnits)
      .set({ name: 'Renamed again', description: 'Edited by an admin' })
      .where(eq(schema.organizationUnits.id, pinnedId(region.slug)));

    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);

    const unit = await findUnit(region.slug);
    expect(unit?.name).toBe(region.name);
    expect(unit?.description).toBe('Edited by an admin');
  });

  it('rolls the whole repair back when it fails part-way', async () => {
    const west = REGIONS[2];
    await db
      .update(schema.organizationUnits)
      .set({ name: 'Drifted before a failing run' })
      .where(eq(schema.organizationUnits.id, pinnedId(west.slug)));

    // The admin membership is the last write of the repair; an unknown user
    // makes it fail after the units were already healed.
    await expect(
      ensureDemoOrganization(db, 'no-such-user', CONFIG),
    ).rejects.toThrow();

    expect((await findUnit(west.slug))?.name).toBe(
      'Drifted before a failing run',
    );

    await ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG);
    expect((await findUnit(west.slug))?.name).toBe(west.name);
  });

  it('validates missing roles before healing anything', async () => {
    const [region] = REGIONS;
    await db
      .update(schema.organizationUnits)
      .set({ name: 'Renamed before a doomed run' })
      .where(eq(schema.organizationUnits.id, pinnedId(region.slug)));
    await db
      .update(schema.roles)
      .set({ name: 'Renamed supervisor' })
      .where(
        and(
          eq(schema.roles.organizationId, ORG_ID),
          eq(schema.roles.name, SUPERVISOR_ROLE),
        ),
      );

    try {
      await expect(
        ensureDemoOrganization(db, ADMIN_USER_ID, CONFIG),
      ).rejects.toThrow('missing expected roles');
      expect((await findUnit(region.slug))?.name).toBe(
        'Renamed before a doomed run',
      );
    } finally {
      await db
        .update(schema.roles)
        .set({ name: SUPERVISOR_ROLE })
        .where(
          and(
            eq(schema.roles.organizationId, ORG_ID),
            eq(schema.roles.name, 'Renamed supervisor'),
          ),
        );
    }
  });
});

describe('assertFixtureIdentitiesAvailable (unit slugs)', () => {
  const FOREIGN_ORG_ID = crypto.randomUUID();
  const FOREIGN_SLUG = 'test-foreign-held-unit-slug';

  beforeAll(async () => {
    await db.insert(schema.organizations).values({
      id: FOREIGN_ORG_ID,
      name: 'Foreign org',
      slug: 'test-foreign-org',
      contactEmail: 'foreign@example.com',
      description: 'Not a fixture',
      street: 'Somewhere 1',
      zipCode: '10115',
      city: 'Berlin',
    });
    const [type] = await db
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: FOREIGN_ORG_ID,
        name: 'Verein',
        description: 'Foreign type',
        icon: 'building-2',
      })
      .returning();
    if (!type) {
      throw new Error('Failed to create foreign unit type');
    }
    await db.insert(schema.organizationUnits).values({
      organizationId: FOREIGN_ORG_ID,
      parentId: null,
      typeId: type.id,
      name: 'Foreign unit',
      slug: FOREIGN_SLUG,
      contactEmail: 'foreign@example.com',
      description: 'Not a fixture',
      street: 'Somewhere 1',
      zipCode: '10115',
      city: 'Berlin',
    });
  });

  it('rejects a fixture unit slug held by another organization', async () => {
    await expect(
      assertFixtureIdentitiesAvailable(db, {
        orgSlug: ORG_SLUG,
        accounts: [],
        unitSlugs: [FOREIGN_SLUG],
      }),
    ).rejects.toThrow(`organization unit slug "${FOREIGN_SLUG}"`);
  });

  it("accepts the fixture organization's own unit slugs", async () => {
    const slug = 'test-pinned-demo';
    const pinned: DemoOrganizationConfig = {
      ...CONFIG,
      orgId: fixtureOrgId(slug),
      orgSlug: slug,
      regions: REGIONS.map((region) => ({
        ...region,
        slug: `${slug}-${region.key}`,
      })),
    };
    await ensureDemoOrganization(db, ADMIN_USER_ID, pinned);

    await assertFixtureIdentitiesAvailable(db, {
      orgSlug: slug,
      accounts: [],
      unitSlugs: [slug, ...pinned.regions.map((region) => region.slug)],
    });
  });
});

describe('ensureDemoOrganization (concurrent first boot)', () => {
  it('lets two replicas seed the same new organization', async () => {
    const slug = 'test-race-demo';
    const config: DemoOrganizationConfig = {
      ...CONFIG,
      orgId: fixtureOrgId(slug),
      orgSlug: slug,
      regions: REGIONS.map((region) => ({
        ...region,
        slug: `${slug}-${region.key}`,
      })),
    };

    const [first, second] = await Promise.all([
      ensureDemoOrganization(db, ADMIN_USER_ID, config),
      ensureDemoOrganization(db, ADMIN_USER_ID, config),
    ]);

    expect(second.organizationId).toBe(first.organizationId);
    expect(second.rootUnitId).toBe(first.rootUnitId);
    expect(
      await db.query.organizationUnits.findMany({
        where: { organizationId: config.orgId },
      }),
    ).toHaveLength(4);
  });
});

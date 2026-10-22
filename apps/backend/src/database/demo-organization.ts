import { eq, inArray } from 'drizzle-orm';
import {
  DEFAULT_MEMBER_ROLE_NAME,
  DEFAULT_OWNER_ROLE_NAME,
  MEMBER_DEFAULT_PERMISSIONS,
  PERMISSIONS,
} from '../auth/constants';
import { permissions } from '../auth/schemas/permission.schema';
import {
  type Database,
  ensureMembershipWithRole,
  fixtureOrgUnitId,
} from './fixture-helpers';
import * as schema from './schema';

const ROOT_UNIT_TYPE_NAME = 'Verein';
const REGION_UNIT_TYPE_NAME = 'Regionalgruppe';

export type DemoRegionKey = 'nord' | 'sued' | 'west';

export type DemoRegionDefinition = {
  key: DemoRegionKey;
  name: string;
  slug: string;
  description: string;
};

/** Everything the reconcile needs to know about the fixture organization. */
export type DemoOrganizationConfig = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgDescription: string;
  contactEmail: string;
  rootCoverImageUrl: string;
  northCoverImageUrl: string;
  supervisorRoleName: string;
  supervisorPermissions: readonly string[];
  regions: readonly DemoRegionDefinition[];
};

export type DemoOrganizationHandles = {
  organizationId: string;
  rootUnitId: string;
  unitIds: Record<DemoRegionKey, string>;
  ownerRoleId: string;
  memberRoleId: string;
  supervisorRoleId: string;
};

type UnitRow = typeof schema.organizationUnits.$inferSelect;

/**
 * Converges a demo unit's structure back to the expected shape: name, place in
 * the tree, type and soft-delete state. Content an admin may legitimately edit
 * (description, address, cover) is left alone — this runs on every deploy.
 * A type that could not be resolved is not healed rather than guessed.
 */
const healUnit = async (
  db: Database,
  unit: UnitRow,
  expected: {
    name: string;
    parentId: string | null;
    typeId: string | undefined;
  },
): Promise<void> => {
  const patch: Partial<typeof schema.organizationUnits.$inferInsert> = {};

  if (unit.name !== expected.name) {
    patch.name = expected.name;
  }
  if (unit.parentId !== expected.parentId) {
    patch.parentId = expected.parentId;
  }
  if (expected.typeId && unit.typeId !== expected.typeId) {
    patch.typeId = expected.typeId;
  }
  if (unit.deletedAt !== null) {
    patch.deletedAt = null;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await db
    .update(schema.organizationUnits)
    .set(patch)
    .where(eq(schema.organizationUnits.id, unit.id));
  console.log(
    `Healed demo unit ${unit.slug}: ${Object.keys(patch).join(', ')}`,
  );
};

type OrganizationRow = typeof schema.organizations.$inferSelect;

const reconcileExistingOrganization = async (
  db: Database,
  existingOrg: OrganizationRow,
  adminUserId: string,
  config: DemoOrganizationConfig,
): Promise<DemoOrganizationHandles> => {
  const {
    orgName,
    orgSlug,
    rootCoverImageUrl,
    northCoverImageUrl,
    supervisorRoleName,
    regions,
  } = config;
  const rootUnitId = fixtureOrgUnitId(orgSlug);

  const units = await db.query.organizationUnits.findMany({
    where: { organizationId: existingOrg.id },
  });

  const findUnit = (id: string, slug: string) =>
    units.find((unit) => unit.id === id) ??
    units.find((unit) => unit.slug === slug);

  // Resolved by id or slug only: any other parentless unit is not ours to
  // rename or retype.
  const rootUnit = findUnit(rootUnitId, orgSlug);

  const unitTypes = await db.query.organizationUnitTypes.findMany({
    where: { organizationId: existingOrg.id },
  });
  const rootTypeId = unitTypes.find(
    (type) => type.name === ROOT_UNIT_TYPE_NAME,
  )?.id;
  const regionTypeId = unitTypes.find(
    (type) => type.name === REGION_UNIT_TYPE_NAME,
  )?.id;

  const roles = await db.query.roles.findMany({
    where: { organizationId: existingOrg.id },
  });
  const ownerRole = roles.find((role) => role.name === DEFAULT_OWNER_ROLE_NAME);
  const memberRole = roles.find(
    (role) => role.name === DEFAULT_MEMBER_ROLE_NAME,
  );
  const supervisorRole = roles.find((role) => role.name === supervisorRoleName);

  const missingRegions = regions.filter(
    (region) => !findUnit(fixtureOrgUnitId(region.slug), region.slug),
  );

  // Validate everything the repair may need before the first write, so a
  // doomed run leaves the fixture org untouched.
  if (!rootUnit && !rootTypeId) {
    throw new Error(
      `Existing ${orgName} organization is missing its root unit and "${ROOT_UNIT_TYPE_NAME}" unit type — cannot recreate it`,
    );
  }
  if (missingRegions.length > 0 && !regionTypeId) {
    throw new Error(
      `Existing ${orgName} organization is missing its "${REGION_UNIT_TYPE_NAME}" unit type — cannot recreate a unit`,
    );
  }
  if (!ownerRole || !memberRole || !supervisorRole) {
    throw new Error(
      `Existing ${orgName} organization is missing expected roles`,
    );
  }

  let resolvedRoot = rootUnit;

  if (!resolvedRoot) {
    if (!rootTypeId) {
      throw new Error(
        `Existing ${orgName} organization is missing its "${ROOT_UNIT_TYPE_NAME}" unit type — cannot recreate its root unit`,
      );
    }

    const [createdRoot] = await db
      .insert(schema.organizationUnits)
      .values({
        id: rootUnitId,
        organizationId: existingOrg.id,
        parentId: null,
        typeId: rootTypeId,
        name: existingOrg.name,
        slug: orgSlug,
        contactEmail: existingOrg.contactEmail,
        description: existingOrg.description,
        coverUrl: rootCoverImageUrl,
        street: 'Museumstraße 23',
        zipCode: '22765',
        city: 'Hamburg',
        legalRep: 'Friederike Lange',
      })
      .onConflictDoNothing()
      .returning();

    resolvedRoot =
      createdRoot ??
      (await db.query.organizationUnits.findFirst({
        where: { organizationId: existingOrg.id, slug: orgSlug },
      }));

    if (!resolvedRoot) {
      throw new Error('Failed to recreate the root organization unit');
    }

    console.log(`Recreated missing demo root unit (${resolvedRoot.id})`);
  } else {
    await healUnit(db, resolvedRoot, {
      name: orgName,
      parentId: null,
      typeId: rootTypeId,
    });
  }

  const unitIds: Record<DemoRegionKey, string> = {
    nord: '',
    sued: '',
    west: '',
  };

  for (const region of regions) {
    const pinnedId = fixtureOrgUnitId(region.slug);
    const existing = findUnit(pinnedId, region.slug);

    if (existing) {
      await healUnit(db, existing, {
        name: region.name,
        parentId: resolvedRoot.id,
        typeId: regionTypeId,
      });
      unitIds[region.key] = existing.id;
      continue;
    }

    if (!regionTypeId) {
      throw new Error(
        `Existing ${orgName} organization is missing its "${REGION_UNIT_TYPE_NAME}" unit type — cannot recreate a unit`,
      );
    }

    const [created] = await db
      .insert(schema.organizationUnits)
      .values({
        id: pinnedId,
        organizationId: existingOrg.id,
        parentId: resolvedRoot.id,
        typeId: regionTypeId,
        name: region.name,
        slug: region.slug,
        contactEmail: existingOrg.contactEmail,
        description: region.description,
        coverUrl: region.key === 'nord' ? northCoverImageUrl : null,
        street: 'Museumstraße 23',
        zipCode: '22765',
        city: 'Hamburg',
      })
      .onConflictDoNothing()
      .returning();

    // A concurrent replica may have won the insert; adopt its row.
    const unit =
      created ??
      (await db.query.organizationUnits.findFirst({
        where: { organizationId: existingOrg.id, slug: region.slug },
      }));

    if (!unit) {
      throw new Error(`Failed to recreate organization unit: ${region.name}`);
    }

    if (created) {
      console.log(`Recreated missing demo unit ${region.slug} (${unit.id})`);
    }

    unitIds[region.key] = unit.id;
  }

  await ensureMembershipWithRole(
    db,
    adminUserId,
    resolvedRoot.id,
    ownerRole.id,
  );

  return {
    organizationId: existingOrg.id,
    rootUnitId: resolvedRoot.id,
    unitIds,
    ownerRoleId: ownerRole.id,
    memberRoleId: memberRole.id,
    supervisorRoleId: supervisorRole.id,
  };
};

/**
 * Creates the fixture organization or reconciles an existing one.
 *
 * Units are resolved by pinned id first, then by the stable slug: rows seeded
 * before unit ids were pinned still carry random ids, and their slug proves
 * ownership without re-keying rows that other tables already reference.
 * Drifted units get their structure back (see `healUnit`), soft-deleted ones
 * are revived, and missing ones are recreated with their pinned id. The repair
 * runs in one transaction after everything it may need has been validated, so
 * a failed run leaves the fixture org as it found it.
 */
export const ensureDemoOrganization = async (
  db: Database,
  adminUserId: string,
  config: DemoOrganizationConfig,
): Promise<DemoOrganizationHandles> => {
  const {
    orgId,
    orgSlug,
    orgName,
    orgDescription,
    contactEmail,
    rootCoverImageUrl,
    northCoverImageUrl,
    supervisorRoleName,
    supervisorPermissions,
    regions,
  } = config;

  const rootUnitId = fixtureOrgUnitId(orgSlug);
  const allPermissionKeys = Object.values(PERMISSIONS).filter(
    (permission) => !permission.startsWith('org-role:'),
  );

  const existingOrg = await db.query.organizations.findFirst({
    where: { id: orgId },
  });

  if (existingOrg) {
    return db.transaction((tx) =>
      reconcileExistingOrganization(tx, existingOrg, adminUserId, config),
    );
  }

  const createdHandles = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(schema.organizations)
      .values({
        id: orgId,
        name: orgName,
        slug: orgSlug,
        contactEmail,
        description: orgDescription,
        street: 'Museumstraße 23',
        zipCode: '22765',
        city: 'Hamburg',
      })
      .onConflictDoNothing()
      .returning();

    if (!organization) {
      return undefined;
    }

    const [rootType] = await tx
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: organization.id,
        name: ROOT_UNIT_TYPE_NAME,
        description: `Trägerverein von ${organization.name}`,
        icon: 'building-2',
      })
      .returning();

    const [regionType] = await tx
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: organization.id,
        name: REGION_UNIT_TYPE_NAME,
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
        id: rootUnitId,
        organizationId: organization.id,
        parentId: null,
        typeId: rootType.id,
        name: organization.name,
        slug: orgSlug,
        contactEmail: organization.contactEmail,
        description: organization.description,
        coverUrl: rootCoverImageUrl,
        street: 'Museumstraße 23',
        zipCode: '22765',
        city: 'Hamburg',
        legalRep: 'Friederike Lange',
      })
      .returning();

    if (!rootUnit) {
      throw new Error('Failed to create root organization unit');
    }

    const regionUnits: Record<DemoRegionKey, string> = {
      nord: '',
      sued: '',
      west: '',
    };

    for (const region of regions) {
      const [unit] = await tx
        .insert(schema.organizationUnits)
        .values({
          id: fixtureOrgUnitId(region.slug),
          organizationId: organization.id,
          parentId: rootUnit.id,
          typeId: regionType.id,
          name: region.name,
          slug: region.slug,
          contactEmail: organization.contactEmail,
          description: region.description,
          coverUrl: region.key === 'nord' ? northCoverImageUrl : null,
          street: 'Museumstraße 23',
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
        name: supervisorRoleName,
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
      .where(inArray(permissions.key, [...supervisorPermissions]));

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

  if (createdHandles) {
    return createdHandles;
  }

  // A concurrent replica won the insert and its transaction has committed by
  // now; reconcile against what it created.
  const raced = await db.query.organizations.findFirst({
    where: { id: orgId },
  });

  if (!raced) {
    throw new Error(
      `Failed to create ${orgName} organization — id ${orgId} or slug "${orgSlug}" may be held by another organization`,
    );
  }

  return db.transaction((tx) =>
    reconcileExistingOrganization(tx, raced, adminUserId, config),
  );
};

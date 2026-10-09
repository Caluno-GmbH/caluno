import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ContractStatus, DocumentKind } from '../src/accounting/enums';
import { VolunteerAllowanceQueryResolver } from '../src/accounting/resolvers/volunteer-allowance-query.resolver';
import { PERMISSIONS } from '../src/auth/constants';
import { PERMISSIONS_KEY } from '../src/auth/decorators/permissions.decorator';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import {
  createReimbursementRate,
  createReimbursementType,
} from './factories/accounting.factory';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  assignRoleToMembership,
  createRole,
  grantPermissionToRole,
} from './factories/role.factory';
import { createShift } from './factories/shift.factory';
import { createUser } from './factories/user.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(30_000);

const STATES = `
  query VolunteerAllowanceStates($volunteerIds: [ID!]!, $shiftInstanceId: ID) {
    volunteerAllowanceStates(
      volunteerIds: $volunteerIds
      shiftInstanceId: $shiftInstanceId
    ) {
      volunteerId
      state
    }
  }
`;

type StateRow = { volunteerId: string; state: string };

const grantPermission = async (db: Database, roleId: string, key: string) => {
  const permission = await db.query.permissions.findFirst({ where: { key } });
  if (!permission) throw new Error(`Permission ${key} not seeded`);
  await grantPermissionToRole(db, { roleId, permissionId: permission.id });
};

const setupOrg = async (
  db: Database,
  { accountingEnabled = true }: { accountingEnabled?: boolean } = {},
) => {
  const reimbursementType = await createReimbursementType(db);
  const { organization, type } = await createOrganizationWithType(
    db,
    `Allowance Org ${crypto.randomUUID()}`,
  );
  const unit = await createUnit(db, {
    organizationId: organization.id,
    typeId: type.id,
    name: 'root',
  });
  await db
    .update(schema.organizations)
    .set({ accountingEnabled })
    .where(eq(schema.organizations.id, organization.id));
  await createReimbursementRate(db, {
    organizationId: organization.id,
    reimbursementTypeId: reimbursementType.id,
    hourlyRateCents: 20_00,
  });

  // A shift planner: may edit shifts, deliberately NOT accounting:manage.
  const plannerRole = await createRole(db, { organizationId: organization.id });
  await grantPermission(db, plannerRole.id, 'shift:edit');
  const planner = await createUser(db);
  const plannerMembership = await addMembership(db, planner.id, unit.id);
  await assignRoleToMembership(db, {
    membershipId: plannerMembership.id,
    roleId: plannerRole.id,
  });

  const member = async () => {
    const user = await createUser(db);
    await addMembership(db, user.id, unit.id);
    return user.id;
  };

  const withActiveContract = async (volunteerId: string) => {
    const [template] = await db
      .insert(schema.documentTemplates)
      .values({
        organizationId: organization.id,
        organizationUnitId: unit.id,
        reimbursementTypeId: reimbursementType.id,
        kind: DocumentKind.CONTRACT,
        body: { header: {}, blocks: [], footer: {} },
      })
      .onConflictDoNothing()
      .returning();
    const documentTemplate =
      template ??
      (await db.query.documentTemplates.findFirst({
        where: {
          organizationId: organization.id,
          reimbursementTypeId: reimbursementType.id,
          kind: DocumentKind.CONTRACT,
        },
      }));
    if (!documentTemplate) throw new Error('No contract template');
    await db.insert(schema.contracts).values({
      documentTemplateId: documentTemplate.id,
      volunteerId,
      reimbursementTypeId: reimbursementType.id,
      organizationUnitId: unit.id,
      contractStatus: ContractStatus.ACTIVE,
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2027-01-01T00:00:00.000Z'),
      resolvedBody: { header: {}, blocks: [], footer: {} },
    });
  };

  const shiftInstanceId = async (paid: boolean, unitId = unit.id) => {
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const shift = await createShift(db, {
      organizationUnitId: unitId,
      reimbursementTypeId: paid ? reimbursementType.id : null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000), // 2h × 20€
    });
    const instance = await db.query.shiftInstances.findFirst({
      where: { masterId: shift.id },
    });
    if (!instance) throw new Error('Shift instance not created');
    return instance.id;
  };

  return {
    organizationId: organization.id,
    unitId: unit.id,
    plannerId: planner.id,
    reimbursementTypeId: reimbursementType.id,
    member,
    withActiveContract,
    shiftInstanceId,
  };
};

describe('volunteerAllowanceStates', () => {
  let app: INestApplication;
  let db: Database;
  let org: Awaited<ReturnType<typeof setupOrg>>;

  const query = (
    volunteerIds: string[],
    shiftInstanceId?: string,
    unitId = org.unitId,
  ) =>
    graphqlRequest<{ volunteerAllowanceStates: StateRow[] }>(app, {
      query: STATES,
      variables: { volunteerIds, shiftInstanceId },
      headers: { 'x-organization-unit-id': unitId },
    });

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    org = await setupOrg(db);
    setAuthMockUserId(org.plannerId);
  });

  it('lets a shift planner without accounting rights see states, and only states', async () => {
    const contracted = await org.member();
    const uncontracted = await org.member();
    await org.withActiveContract(contracted);

    const response = await query(
      [contracted, uncontracted],
      await org.shiftInstanceId(true),
    );

    expect(response.errors).toBeUndefined();
    expect(response.data?.volunteerAllowanceStates).toEqual([
      { volunteerId: contracted, state: 'ELIGIBLE' },
      { volunteerId: uncontracted, state: 'NO_AGREEMENT' },
    ]);
  });

  it('reports WOULD_EXCEED when this shift would pass the yearly ceiling', async () => {
    const nearCeiling = await org.member();
    await org.withActiveContract(nearCeiling);
    await db.insert(schema.reimbursementManualBaselines).values({
      organizationId: org.organizationId,
      volunteerId: nearCeiling,
      reimbursementTypeId: org.reimbursementTypeId,
      year: 2026,
      amountCents: 830_00, // 10 € left, the 2h shift costs 40 €
    });

    const response = await query(
      [nearCeiling],
      await org.shiftInstanceId(true),
    );

    expect(response.data?.volunteerAllowanceStates).toEqual([
      { volunteerId: nearCeiling, state: 'WOULD_EXCEED' },
    ]);
  });

  it('never reports WOULD_EXCEED for an unpaid shift', async () => {
    const nearCeiling = await org.member();
    await org.withActiveContract(nearCeiling);
    await db.insert(schema.reimbursementManualBaselines).values({
      organizationId: org.organizationId,
      volunteerId: nearCeiling,
      reimbursementTypeId: org.reimbursementTypeId,
      year: 2026,
      amountCents: 830_00,
    });

    const response = await query(
      [nearCeiling],
      await org.shiftInstanceId(false),
    );

    expect(response.data?.volunteerAllowanceStates).toEqual([]);
  });

  it('omits people who are not members of the caller unit', async () => {
    const other = await setupOrg(db);
    const outsider = await other.member();
    await other.withActiveContract(outsider);
    const insider = await org.member();

    const response = await query([insider, outsider]);

    expect(
      response.data?.volunteerAllowanceStates.map((row) => row.volunteerId),
    ).toEqual([insider]);
  });

  it("rejects a shift instance from another organisation's unit", async () => {
    const other = await setupOrg(db);
    const foreignInstance = await other.shiftInstanceId(true);

    const response = await query([await org.member()], foreignInstance);

    expect(response.errors?.[0]?.message).toBe('Shift instance not found');
  });

  // The GraphQL test app switches PermissionGuard off, so the guard itself
  // cannot be exercised here; pin what it is told to enforce instead.
  it('requires exactly the shift edit permission, not accounting rights', () => {
    const required = Reflect.getMetadata(
      PERMISSIONS_KEY,
      VolunteerAllowanceQueryResolver.prototype.volunteerAllowanceStates,
    );

    expect(required).toEqual([PERMISSIONS.SHIFT_EDIT]);
  });

  it('returns nothing, not an error, when accounting is disabled', async () => {
    const off = await setupOrg(db, { accountingEnabled: false });
    setAuthMockUserId(off.plannerId);
    try {
      const response = await query([await off.member()], undefined, off.unitId);
      expect(response.errors).toBeUndefined();
      expect(response.data?.volunteerAllowanceStates).toEqual([]);
    } finally {
      setAuthMockUserId(org.plannerId);
    }
  });
});

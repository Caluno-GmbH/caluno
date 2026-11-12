import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { MembershipRequestStatus } from '../src/membership/enums';
import { MembershipService } from '../src/membership/membership.service';
import { TimeTrackingService } from '../src/time-tracking/time-tracking.service';
import { createMembershipRequest, createShift, createUser } from './factories';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { grantCheckInManage } from './factories/role.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequestRequiringData } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

describe('TimeTrackingService.getCheckInContext', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;
  let testUserId: string;
  let service: TimeTrackingService;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitId = context.organizationUnitId;
    testUserId = context.testUserId;
    service = app.get(TimeTrackingService);
  });

  // Restore the shared context user so the mock user never leaks into other
  // spec files running in the same process.
  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  const insertOpenEntry = async (volunteerId: string, unitId: string) => {
    const [entry] = await db
      .insert(schema.timeEntries)
      .values({
        volunteerId,
        organizationUnitId: unitId,
        startedAt: new Date(),
        endedAt: null,
      })
      .returning();
    return entry;
  };

  it('returns null for an unknown check-in id', async () => {
    const result = await service.getCheckInContext(testUserId, 'doesnotexist');
    expect(result).toBeNull();
  });

  it('returns open entries only from units where the caller has check-in:manage and the volunteer is a member', async () => {
    const volunteer = await createUser(db);
    // Member of the context org unit (caller manages it via owner role).
    await addMembership(db, volunteer.id, organizationUnitId);
    const visibleEntry = await insertOpenEntry(
      volunteer.id,
      organizationUnitId,
    );

    // Foreign org: the caller has no membership there at all.
    const foreign = await createOrganizationWithType(
      db,
      `Foreign ${crypto.randomUUID()}`,
    );
    const foreignUnit = await createUnit(db, {
      organizationId: foreign.organization.id,
      typeId: foreign.type.id,
      name: 'Foreign Unit',
    });
    await addMembership(db, volunteer.id, foreignUnit.id);
    await insertOpenEntry(volunteer.id, foreignUnit.id);

    const result = await service.getCheckInContext(
      testUserId,
      volunteer.checkInId,
    );

    expect(result?.volunteer?.id).toBe(volunteer.id);
    expect(result?.openTimeEntries.map((e) => e.id)).toEqual([visibleEntry.id]);
    // toContain, not toEqual: other specs share this context org and may add
    // child units, which are eligible too via the ancestor walk.
    expect(result?.eligibleOrganizationUnits.map((u) => u.id)).toContain(
      organizationUnitId,
    );
    expect(result?.eligibleOrganizationUnits.map((u) => u.id)).not.toContain(
      foreignUnit.id,
    );
  });

  it('returns a context with volunteer null when the volunteer is unrelated to every caller-manageable unit', async () => {
    // Second org where the CALLER has check-in:manage but the volunteer is
    // NOT a member.
    const other = await createOrganizationWithType(
      db,
      `Other ${crypto.randomUUID()}`,
    );
    const otherUnit = await createUnit(db, {
      organizationId: other.organization.id,
      typeId: other.type.id,
      name: 'Other Unit',
    });
    await grantCheckInManage(db, {
      organizationId: other.organization.id,
      organizationUnitId: otherUnit.id,
      userId: testUserId,
    });

    // Volunteer has an open entry there but no membership.
    const volunteer = await createUser(db);
    await insertOpenEntry(volunteer.id, otherUnit.id);

    const result = await service.getCheckInContext(
      testUserId,
      volunteer.checkInId,
    );

    // The caller manages units, so the QR code resolves to a context, but
    // nothing relates the volunteer to them: no identity, no entries (ADR 0001).
    expect(result).toEqual({
      volunteer: null,
      eligibleOrganizationUnits: [],
      pendingOrganizationUnits: [],
      openTimeEntries: [],
    });
  });

  it('returns null for a caller without any check-in:manage unit', async () => {
    const volunteer = await createUser(db);
    const plainCaller = await createUser(db); // no memberships anywhere

    const result = await service.getCheckInContext(
      plainCaller.id,
      volunteer.checkInId,
    );

    expect(result).toBeNull();
  });

  it('returns null for a caller without any check-in:manage permission', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitId);
    await insertOpenEntry(volunteer.id, organizationUnitId);

    const outsider = await createUser(db); // no memberships anywhere

    const result = await service.getCheckInContext(
      outsider.id,
      volunteer.checkInId,
    );

    expect(result).toBeNull();
  });

  it('checks eligibility across multiple manageable units, ancestor-inclusive', async () => {
    const org = await createOrganizationWithType(
      db,
      `Batch ${crypto.randomUUID()}`,
    );
    const parentUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Parent Unit',
    });
    const childUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Child Unit',
      parentId: parentUnit.id,
    });
    // Volunteer is a member of the PARENT only — eligibility on the child
    // comes from the ancestor walk.
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, parentUnit.id);

    // Caller needs check-in:manage on the Batch org to manage its units.
    await grantCheckInManage(db, {
      organizationId: org.organization.id,
      organizationUnitId: parentUnit.id,
      userId: testUserId,
    });

    // A second org (only one root per org is allowed, so the "stranger"
    // unit lives here): caller manages it, volunteer is not a member.
    const otherOrg = await createOrganizationWithType(
      db,
      `BatchOther ${crypto.randomUUID()}`,
    );
    const strangerUnit = await createUnit(db, {
      organizationId: otherOrg.organization.id,
      typeId: otherOrg.type.id,
      name: 'Stranger Unit',
    });
    await grantCheckInManage(db, {
      organizationId: otherOrg.organization.id,
      organizationUnitId: strangerUnit.id,
      userId: testUserId,
    });

    const result = await service.getCheckInContext(
      testUserId,
      volunteer.checkInId,
    );

    const eligibleIds = result?.eligibleOrganizationUnits.map((u) => u.id);
    expect(eligibleIds).toContain(childUnit.id);
    expect(eligibleIds).not.toContain(strangerUnit.id);
  });

  it('filterUnitsWhereMemberOrAncestor returns only member-or-descendant units', async () => {
    const membershipService = app.get(MembershipService);
    const org = await createOrganizationWithType(
      db,
      `Filter ${crypto.randomUUID()}`,
    );
    const parentUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Filter Parent',
    });
    const childUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Filter Child',
      parentId: parentUnit.id,
    });
    // Second org: only one root per org is allowed, and a sibling under
    // parentUnit would be eligible via the ancestor walk — so the
    // ineligible unit lives in its own org.
    const otherOrg = await createOrganizationWithType(
      db,
      `FilterOther ${crypto.randomUUID()}`,
    );
    const otherUnit = await createUnit(db, {
      organizationId: otherOrg.organization.id,
      typeId: otherOrg.type.id,
      name: 'Filter Other',
    });

    const user = await createUser(db);
    await addMembership(db, user.id, parentUnit.id);

    const result = await membershipService.filterUnitsWhereMemberOrAncestor(
      user.id,
      [parentUnit.id, childUnit.id, otherUnit.id, 'does-not-exist'],
    );

    expect([...result].sort()).toEqual([childUnit.id, parentUnit.id].sort());
    expect(
      await membershipService.filterUnitsWhereMemberOrAncestor(user.id, []),
    ).toEqual(new Set());
  });

  it('reveals the volunteer when they have a pending request to a managed unit', async () => {
    const volunteer = await createUser(db);
    await createMembershipRequest(db, {
      userId: volunteer.id,
      organizationUnitId,
    });

    const result = await service.getCheckInContext(
      testUserId,
      volunteer.checkInId,
    );

    expect(result?.volunteer?.id).toBe(volunteer.id);
    expect(result?.pendingOrganizationUnits.map((u) => u.id)).toContain(
      organizationUnitId,
    );
    expect(result?.eligibleOrganizationUnits).toEqual([]);
  });

  it('filterUnitsWithPendingRequest matches pending requests on the unit or an ancestor only', async () => {
    const membershipService = app.get(MembershipService);
    const org = await createOrganizationWithType(
      db,
      `Pending ${crypto.randomUUID()}`,
    );
    const parentUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Pending Parent',
    });
    const childUnit = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Pending Child',
      parentId: parentUnit.id,
    });
    const otherOrg = await createOrganizationWithType(
      db,
      `PendingOther ${crypto.randomUUID()}`,
    );
    const otherUnit = await createUnit(db, {
      organizationId: otherOrg.organization.id,
      typeId: otherOrg.type.id,
      name: 'Pending Other',
    });

    const user = await createUser(db);
    await createMembershipRequest(db, {
      userId: user.id,
      organizationUnitId: parentUnit.id,
    });
    // Non-pending requests must not count.
    await createMembershipRequest(db, {
      userId: user.id,
      organizationUnitId: otherUnit.id,
      status: MembershipRequestStatus.REJECTED,
    });

    const result = await membershipService.filterUnitsWithPendingRequest(
      user.id,
      [parentUnit.id, childUnit.id, otherUnit.id, 'does-not-exist'],
    );

    expect([...result].sort()).toEqual([childUnit.id, parentUnit.id].sort());
    expect(
      await membershipService.filterUnitsWithPendingRequest(user.id, []),
    ).toEqual(new Set());
  });
});

describe('checkInContext query', () => {
  let app: INestApplication;
  let db: Database;
  let organizationUnitId: string;
  let testUserId: string;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationUnitId = context.organizationUnitId;
    testUserId = context.testUserId;
  });

  afterEach(() => {
    setAuthMockUserId(testUserId);
  });

  const insertOpenEntryFor = async (volunteerId: string, unitId: string) => {
    await db.insert(schema.timeEntries).values({
      volunteerId,
      organizationUnitId: unitId,
      startedAt: new Date(),
      endedAt: null,
    });
  };

  it('returns volunteer, eligible units and open entries', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitId);
    await db.insert(schema.timeEntries).values({
      volunteerId: volunteer.id,
      organizationUnitId,
      startedAt: new Date(),
      endedAt: null,
    });

    const data = await graphqlRequestRequiringData<{
      checkInContext: {
        volunteer: { id: string; name: string };
        eligibleOrganizationUnits: Array<{ id: string; name: string }>;
        openTimeEntries: Array<{
          id: string;
          startedAt: string;
          organizationUnit: { id: string; name: string };
        }>;
      };
    }>(
      app,
      {
        query: `
          query CheckInContext($checkInId: String!) {
            checkInContext(checkInId: $checkInId) {
              volunteer { id name }
              eligibleOrganizationUnits { id name }
              openTimeEntries {
                id
                startedAt
                organizationUnit { id name }
              }
            }
          }
        `,
        variables: { checkInId: volunteer.checkInId },
      },
      'checkInContext',
    );

    expect(data.checkInContext.volunteer.id).toBe(volunteer.id);
    expect(
      data.checkInContext.eligibleOrganizationUnits.map((u) => u.id),
    ).toContain(organizationUnitId);
    expect(data.checkInContext.openTimeEntries).toHaveLength(1);
    expect(data.checkInContext.openTimeEntries[0]?.organizationUnit.id).toBe(
      organizationUnitId,
    );
  });

  it('resolves shiftInstance details without an org unit header', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitId);

    const shift = await createShift(db, { organizationUnitId });
    const instance = await db.query.shiftInstances.findFirst({
      where: { masterId: shift.id },
    });
    expect(instance).toBeDefined();

    await db.insert(schema.timeEntries).values({
      volunteerId: volunteer.id,
      organizationUnitId,
      shiftInstanceId: instance?.id,
      startedAt: new Date(),
      endedAt: null,
    });

    const data = await graphqlRequestRequiringData<{
      checkInContext: {
        openTimeEntries: Array<{
          id: string;
          shiftInstance: {
            id: string;
            overrideTitle: string | null;
            master: { id: string; title: string };
          } | null;
        }>;
      };
    }>(
      app,
      {
        query: `
          query CheckInContext($checkInId: String!) {
            checkInContext(checkInId: $checkInId) {
              openTimeEntries {
                id
                shiftInstance {
                  id
                  overrideTitle
                  master { id title }
                }
              }
            }
          }
        `,
        variables: { checkInId: volunteer.checkInId },
      },
      'checkInContext',
    );

    expect(data.checkInContext.openTimeEntries).toHaveLength(1);
    expect(data.checkInContext.openTimeEntries[0]?.shiftInstance?.id).toBe(
      instance?.id,
    );
    expect(
      data.checkInContext.openTimeEntries[0]?.shiftInstance?.master.title,
    ).toBeTruthy();
  });

  it('returns null for an unknown check-in id', async () => {
    const data = await graphqlRequestRequiringData<{
      checkInContext: null;
    }>(
      app,
      {
        query: `
          query CheckInContext($checkInId: String!) {
            checkInContext(checkInId: $checkInId) {
              volunteer { id }
            }
          }
        `,
        variables: { checkInId: 'doesnotexist' },
      },
      'checkInContext',
    );

    expect(data.checkInContext).toBeNull();
  });

  const unrelatedQuery = `
    query CheckInContext($checkInId: String!) {
      checkInContext(checkInId: $checkInId) {
        volunteer { id name }
        eligibleOrganizationUnits { id }
        pendingOrganizationUnits { id }
        openTimeEntries { id }
      }
    }
  `;

  it('returns null when the caller has no check-in:manage unit', async () => {
    const volunteer = await createUser(db);
    await addMembership(db, volunteer.id, organizationUnitId);

    const plainCaller = await createUser(db); // no memberships anywhere
    setAuthMockUserId(plainCaller.id);

    const data = await graphqlRequestRequiringData<{
      checkInContext: null;
    }>(
      app,
      { query: unrelatedQuery, variables: { checkInId: volunteer.checkInId } },
      'checkInContext',
    );

    expect(data.checkInContext).toBeNull();
  });

  it('returns a context with volunteer null for an unrelated volunteer', async () => {
    // Caller (the context test user) manages unit A; the volunteer has no
    // membership or request anywhere.
    const volunteer = await createUser(db);
    await insertOpenEntryFor(volunteer.id, organizationUnitId);

    const data = await graphqlRequestRequiringData<{
      checkInContext: {
        volunteer: null;
        eligibleOrganizationUnits: unknown[];
        pendingOrganizationUnits: unknown[];
        openTimeEntries: unknown[];
      };
    }>(
      app,
      { query: unrelatedQuery, variables: { checkInId: volunteer.checkInId } },
      'checkInContext',
    );

    expect(data.checkInContext).toEqual({
      volunteer: null,
      eligibleOrganizationUnits: [],
      pendingOrganizationUnits: [],
      openTimeEntries: [],
    });
  });

  it('reveals the volunteer when they have a pending request to a managed unit', async () => {
    const volunteer = await createUser(db);
    const org = await createOrganizationWithType(
      db,
      `PendingGql ${crypto.randomUUID()}`,
    );
    const unitA = await createUnit(db, {
      organizationId: org.organization.id,
      typeId: org.type.id,
      name: 'Pending Unit A',
    });
    await grantCheckInManage(db, {
      organizationId: org.organization.id,
      organizationUnitId: unitA.id,
      userId: testUserId,
    });
    await createMembershipRequest(db, {
      userId: volunteer.id,
      organizationUnitId: unitA.id,
    });

    const data = await graphqlRequestRequiringData<{
      checkInContext: {
        volunteer: { id: string };
        eligibleOrganizationUnits: unknown[];
        pendingOrganizationUnits: Array<{ id: string }>;
      };
    }>(
      app,
      { query: unrelatedQuery, variables: { checkInId: volunteer.checkInId } },
      'checkInContext',
    );

    expect(data.checkInContext.volunteer.id).toBe(volunteer.id);
    expect(data.checkInContext.eligibleOrganizationUnits).toEqual([]);
    expect(data.checkInContext.pendingOrganizationUnits).toEqual([
      { id: unitA.id },
    ]);
  });

  it('does not reveal the volunteer for a pending request to an unmanaged unit', async () => {
    const volunteer = await createUser(db);
    // Caller manages the context unit but has no permission in this org.
    const foreign = await createOrganizationWithType(
      db,
      `ForeignPending ${crypto.randomUUID()}`,
    );
    const foreignUnit = await createUnit(db, {
      organizationId: foreign.organization.id,
      typeId: foreign.type.id,
      name: 'Foreign Pending Unit',
    });
    await createMembershipRequest(db, {
      userId: volunteer.id,
      organizationUnitId: foreignUnit.id,
    });

    const data = await graphqlRequestRequiringData<{
      checkInContext: {
        volunteer: null;
        pendingOrganizationUnits: unknown[];
      };
    }>(
      app,
      { query: unrelatedQuery, variables: { checkInId: volunteer.checkInId } },
      'checkInContext',
    );

    expect(data.checkInContext.volunteer).toBeNull();
    expect(data.checkInContext.pendingOrganizationUnits).toEqual([]);
  });
});

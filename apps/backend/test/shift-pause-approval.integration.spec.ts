import 'reflect-metadata';
import { beforeAll, describe, expect, it, mock } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { AccountingOrgAccessService } from '../src/accounting/services/accounting-org-access.service';
import type { AuthService } from '../src/auth/auth.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import type { MembershipService } from '../src/membership/membership.service';
import type { NotificationService } from '../src/notification/notification.service';
import { OrganizationUnitAutomationKind } from '../src/organization/enums';
import type { OrganizationService } from '../src/organization/organization.service';
import { OrganizationUnitService } from '../src/organization/organization-unit.service';
import { OrganizationUnitAutomationService } from '../src/organization/organization-unit-automation.service';
import { ALL_WEEKDAYS, type Weekday } from '../src/shared/enums/weekday.enum';
import type { PostHogService } from '../src/shared/observability/posthog.service';
import { ShiftInviteStatus } from '../src/shift/enums';
import { ShiftService } from '../src/shift/shift.service';
import { appWeekday } from '../src/shift/utils/app-time';
import { slugify } from '../src/utils/slug.util';
import { createShift, createUser } from './factories';
import { createShiftInstanceInvite } from './factories/shift-instance-invite.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

const HOURS = 3_600_000;

describe('ShiftService pause approval', () => {
  let moduleRef: TestingModule;
  let shiftService: ShiftService;
  let automationService: OrganizationUnitAutomationService;
  let db: Database;
  let organizationUnitId: string;

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    automationService = new OrganizationUnitAutomationService(db);

    const organizationUnitService = new OrganizationUnitService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    shiftService = new ShiftService(
      db,
      { findUsersWithPermission: async () => [] } as unknown as AuthService,
      {} as never,
      {
        isMemberOfUnitOrAncestor: async () => true,
        getMembershipState: async () => 'JOINED',
      } as unknown as MembershipService,
      {
        notifyShiftInstanceJoined: mock(() => {}),
        notifyShiftInstanceJoinRequested: mock(() => {}),
      } as unknown as NotificationService,
      {} as OrganizationService,
      {} as never,
      { getRequiredFormStatuses: async () => [] } as never,
      { shareSubmissionsWithOrgUnit: async () => {} } as never,
      { capture: mock(() => {}) } as unknown as PostHogService,
      new AccountingOrgAccessService(db, organizationUnitService),
      automationService,
    );

    const orgName = `Pause Approval Org ${crypto.randomUUID()}`;
    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: orgName, slug: slugify(orgName) })
      .returning();
    const [rootType] = await db
      .insert(schema.organizationUnitTypes)
      .values({
        organizationId: organization.id,
        name: 'organisation unit',
        description: `organization unit for ${orgName}`,
        icon: 'building-2',
      })
      .returning();
    const [rootUnit] = await db
      .insert(schema.organizationUnits)
      .values({
        organizationId: organization.id,
        parentId: null,
        typeId: rootType.id,
        name: organization.name,
        slug: organization.slug,
      })
      .returning();

    organizationUnitId = rootUnit.id;

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
  });

  /**
   * The shift starts `hoursFromNow` out, so which weekday it lands on depends
   * on when the suite runs — each case reads the instance's own weekday back
   * and configures the automation relative to it.
   */
  async function createApprovalShift(options: {
    hoursFromNow: number;
    minVolunteers: number | null;
    joinedCount?: number;
  }) {
    const startsAt = new Date(Date.now() + options.hoursFromNow * HOURS);
    const shift = await createShift(db, {
      organizationUnitId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * HOURS),
      rrule: null,
      minVolunteers: options.minVolunteers,
    });
    await db
      .update(schema.shifts)
      .set({ joinRequiresApproval: true })
      .where(eq(schema.shifts.id, shift.id));

    const instance = await db.query.shiftInstances.findFirst({
      where: { masterId: shift.id },
    });
    if (!instance) throw new Error('Expected the shift to expand an instance');

    for (let i = 0; i < (options.joinedCount ?? 0); i++) {
      await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: (await createUser(db)).id,
        status: ShiftInviteStatus.JOINED,
      });
    }

    return { shift, instance, weekday: appWeekday(instance.actualStartsAt) };
  }

  async function setPauseApproval(settings: {
    enabled: boolean;
    activeDays: Weekday[];
    leadTimeHours: number;
  }) {
    await automationService.update(
      organizationUnitId,
      OrganizationUnitAutomationKind.PAUSE_APPROVAL,
      settings,
    );
  }

  async function joinAndReadStatus(instanceId: string) {
    const volunteerId = (await createUser(db)).id;
    await shiftService.joinShiftInstance(volunteerId, instanceId, {
      formsAlreadySatisfied: true,
    });

    const invite = await db.query.shiftInstanceInvites.findFirst({
      where: { instanceId, userId: volunteerId },
    });
    return invite?.status;
  }

  function otherThan(weekday: Weekday): Weekday[] {
    return ALL_WEEKDAYS.filter((day) => day !== weekday);
  }

  it('confirms a sign-up straight away for an understaffed shift inside the window', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 20,
      minVolunteers: 3,
    });
    await setPauseApproval({
      enabled: true,
      activeDays: [weekday],
      leadTimeHours: 48,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(ShiftInviteStatus.JOINED);
  });

  it('requires approval again once the shift has reached its minimum', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 20,
      minVolunteers: 2,
      joinedCount: 2,
    });
    await setPauseApproval({
      enabled: true,
      activeDays: [weekday],
      leadTimeHours: 48,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(
      ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    );
  });

  it('never affects a shift without a minimum', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 20,
      minVolunteers: null,
    });
    await setPauseApproval({
      enabled: true,
      activeDays: [weekday],
      leadTimeHours: 48,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(
      ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    );
  });

  it('leaves shifts on days the coordinator did not select alone', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 20,
      minVolunteers: 3,
    });
    await setPauseApproval({
      enabled: true,
      activeDays: otherThan(weekday),
      leadTimeHours: 48,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(
      ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    );
  });

  it('leaves shifts starting beyond the lead time alone', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 30,
      minVolunteers: 3,
    });
    await setPauseApproval({
      enabled: true,
      activeDays: [weekday],
      leadTimeHours: 24,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(
      ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    );
  });

  it('does nothing while the automation is switched off', async () => {
    const { instance, weekday } = await createApprovalShift({
      hoursFromNow: 20,
      minVolunteers: 3,
    });
    await setPauseApproval({
      enabled: false,
      activeDays: [weekday],
      leadTimeHours: 48,
    });

    expect(await joinAndReadStatus(instance.id)).toBe(
      ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    );
  });
});

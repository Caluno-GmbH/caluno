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
import { ConflictGraphQLError } from '../src/graphql/errors/conflict.error';
import { NotFoundGraphQLError } from '../src/graphql/errors/not-found.error';
import type { MembershipService } from '../src/membership/membership.service';
import type { NotificationService } from '../src/notification/notification.service';
import type { OrganizationService } from '../src/organization/organization.service';
import { OrganizationUnitService } from '../src/organization/organization-unit.service';
import type { PostHogService } from '../src/shared/observability/posthog.service';
import { ShiftInviteStatus } from '../src/shift/enums';
import { ShiftService } from '../src/shift/shift.service';
import { slugify } from '../src/utils/slug.util';
import { createShift, createUser } from './factories';
import { createShiftInstanceInvite } from './factories/shift-instance-invite.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

const DAILY_RRULE = 'FREQ=DAILY;INTERVAL=1';

describe('ShiftService.updateShiftInstanceApproval', () => {
  let moduleRef: TestingModule;
  let shiftService: ShiftService;
  let db: Database;
  let userId: string;
  let organizationUnitId: string;
  let notifyShiftInstanceJoinApproved: ReturnType<typeof mock>;
  let notifyShiftInstanceWaitlistJoined: ReturnType<typeof mock>;

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    notifyShiftInstanceJoinApproved = mock(() => {});
    notifyShiftInstanceWaitlistJoined = mock(() => {});
    const notificationService = {
      notifyShiftInstanceJoinApproved,
      notifyShiftInstanceWaitlistJoined,
    } as unknown as NotificationService;

    const organizationUnitService = new OrganizationUnitService(
      db,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const accountingOrgAccessService = new AccountingOrgAccessService(
      db,
      organizationUnitService,
    );
    const membershipService = {
      isMemberOfUnitOrAncestor: async () => true,
      getMembershipState: async () => 'JOINED',
    } as unknown as MembershipService;

    shiftService = new ShiftService(
      db,
      {} as AuthService,
      {} as never,
      membershipService,
      notificationService,
      {} as OrganizationService,
      {
        assertUploadedFileForPurpose: async () => ({}),
        resolvePublicUrlForUploadedFile: async () =>
          'https://example.com/image.png',
      } as never,
      { getRequiredFormStatuses: async () => [] } as never,
      { shareSubmissionsWithOrgUnit: async () => {} } as never,
      { capture: mock(() => {}) } as unknown as PostHogService,
      accountingOrgAccessService,
    );

    userId = (await createUser(db)).id;

    const orgName = `Approval Test Org ${crypto.randomUUID()}`;
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

  const future = (msFromNow: number) => new Date(Date.now() + msFromNow);

  const getShiftInstances = (masterId: string) =>
    db.query.shiftInstances.findMany({
      where: { masterId },
      orderBy: { actualStartsAt: 'asc' },
    });

  const getInstance = async (id: string) =>
    (
      await db
        .select()
        .from(schema.shiftInstances)
        .where(eq(schema.shiftInstances.id, id))
    )[0];

  const getShift = async (id: string) =>
    (await db.select().from(schema.shifts).where(eq(schema.shifts.id, id)))[0];

  const getInviteStatus = async (id: string) =>
    (
      await db
        .select()
        .from(schema.shiftInstanceInvites)
        .where(eq(schema.shiftInstanceInvites.id, id))
    )[0]?.status;

  const setInviteCreatedAt = (inviteId: string, createdAt: Date) =>
    db
      .update(schema.shiftInstanceInvites)
      .set({ createdAt })
      .where(eq(schema.shiftInstanceInvites.id, inviteId));

  const setInstanceOverride = (instanceId: string, value: boolean | null) =>
    db
      .update(schema.shiftInstances)
      .set({ overrideJoinRequiresApproval: value })
      .where(eq(schema.shiftInstances.id, instanceId));

  describe('turning approval on', () => {
    it('overrides only the toggled occurrence and leaves the master and existing invites untouched', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: DAILY_RRULE,
      });
      const [instance] = await getShiftInstances(shift.id);
      const volunteer = await createUser(db);
      const invite = await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: volunteer.id,
        status: ShiftInviteStatus.JOINED,
      });

      const result = await shiftService.updateShiftInstanceApproval(
        instance.id,
        organizationUnitId,
        true,
        { applyToAllFuture: false },
      );

      expect(result.overrideJoinRequiresApproval).toBe(true);
      expect((await getShift(shift.id)).joinRequiresApproval).toBe(false);
      expect(await getInviteStatus(invite.id)).toBe(ShiftInviteStatus.JOINED);
    });

    it('sets the master flag for "apply to all future" without disturbing an already-overridden future instance', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: DAILY_RRULE,
      });
      const [first, second] = await getShiftInstances(shift.id);
      await setInstanceOverride(second.id, false);

      await shiftService.updateShiftInstanceApproval(
        first.id,
        organizationUnitId,
        true,
        { applyToAllFuture: true },
      );

      expect((await getShift(shift.id)).joinRequiresApproval).toBe(true);
      expect((await getInstance(second.id)).overrideJoinRequiresApproval).toBe(
        false,
      );
    });
  });

  describe('turning approval off', () => {
    it('admits the oldest pending requests up to capacity and waitlists the overflow', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: null,
        maxVolunteers: 2,
      });
      await db
        .update(schema.shifts)
        .set({ joinRequiresApproval: true })
        .where(eq(schema.shifts.id, shift.id));
      const [instance] = await getShiftInstances(shift.id);

      const joinedVolunteer = await createUser(db);
      await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: joinedVolunteer.id,
        status: ShiftInviteStatus.JOINED,
      });

      const oldest = await createUser(db);
      const middle = await createUser(db);
      const newest = await createUser(db);
      const oldestInvite = await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: oldest.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      const middleInvite = await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: middle.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      const newestInvite = await createShiftInstanceInvite(db, {
        instanceId: instance.id,
        userId: newest.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      await setInviteCreatedAt(
        oldestInvite.id,
        new Date('2020-01-01T00:00:00Z'),
      );
      await setInviteCreatedAt(
        middleInvite.id,
        new Date('2020-01-02T00:00:00Z'),
      );
      await setInviteCreatedAt(
        newestInvite.id,
        new Date('2020-01-03T00:00:00Z'),
      );

      notifyShiftInstanceJoinApproved.mockClear();
      notifyShiftInstanceWaitlistJoined.mockClear();

      // A one-time shift (rrule: null) always routes through the master/
      // series path, regardless of applyToAllFuture — mirrors updateShiftInstance.
      const result = await shiftService.updateShiftInstanceApproval(
        instance.id,
        organizationUnitId,
        false,
        { applyToAllFuture: false },
      );

      expect(result.overrideJoinRequiresApproval).toBeNull();
      expect((await getShift(shift.id)).joinRequiresApproval).toBe(false);

      // The sweep's notifications are fired without being awaited; let their
      // pending organizationUnits lookup (a real DB round trip) settle
      // before asserting.
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await getInviteStatus(oldestInvite.id)).toBe(
        ShiftInviteStatus.JOINED,
      );
      expect(await getInviteStatus(middleInvite.id)).toBe(
        ShiftInviteStatus.WAITLIST_JOINED,
      );
      expect(await getInviteStatus(newestInvite.id)).toBe(
        ShiftInviteStatus.WAITLIST_JOINED,
      );

      expect(notifyShiftInstanceJoinApproved).toHaveBeenCalledTimes(1);
      expect(notifyShiftInstanceJoinApproved.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          userId: oldest.id,
          shiftId: shift.id,
          instanceId: instance.id,
        }),
      );
      expect(notifyShiftInstanceWaitlistJoined).toHaveBeenCalledTimes(2);
    });

    it('scopes the sweep to only the toggled occurrence for "only this occurrence"', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: DAILY_RRULE,
        maxVolunteers: 5,
      });
      const [first, second] = await getShiftInstances(shift.id);
      await setInstanceOverride(first.id, true);
      await setInstanceOverride(second.id, true);

      const volunteerOnFirst = await createUser(db);
      const volunteerOnSecond = await createUser(db);
      const firstInvite = await createShiftInstanceInvite(db, {
        instanceId: first.id,
        userId: volunteerOnFirst.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      const secondInvite = await createShiftInstanceInvite(db, {
        instanceId: second.id,
        userId: volunteerOnSecond.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });

      await shiftService.updateShiftInstanceApproval(
        first.id,
        organizationUnitId,
        false,
        { applyToAllFuture: false },
      );

      expect((await getInstance(first.id)).overrideJoinRequiresApproval).toBe(
        false,
      );
      expect(await getInviteStatus(firstInvite.id)).toBe(
        ShiftInviteStatus.JOINED,
      );

      // The sibling occurrence is untouched: still requires approval, its
      // invite still pending.
      expect((await getInstance(second.id)).overrideJoinRequiresApproval).toBe(
        true,
      );
      expect(await getInviteStatus(secondInvite.id)).toBe(
        ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      );
    });

    it('sweeps every future occurrence for "all future" but skips one with its own override still requiring approval', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: DAILY_RRULE,
        maxVolunteers: 5,
      });
      await db
        .update(schema.shifts)
        .set({ joinRequiresApproval: true })
        .where(eq(schema.shifts.id, shift.id));
      const [first, second, third] = await getShiftInstances(shift.id);
      // Explicitly still requires approval — must be excluded from the sweep.
      await setInstanceOverride(second.id, true);

      const volunteerOnFirst = await createUser(db);
      const volunteerOnSecond = await createUser(db);
      const volunteerOnThird = await createUser(db);
      const firstInvite = await createShiftInstanceInvite(db, {
        instanceId: first.id,
        userId: volunteerOnFirst.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      const secondInvite = await createShiftInstanceInvite(db, {
        instanceId: second.id,
        userId: volunteerOnSecond.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });
      const thirdInvite = await createShiftInstanceInvite(db, {
        instanceId: third.id,
        userId: volunteerOnThird.id,
        status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      });

      await shiftService.updateShiftInstanceApproval(
        first.id,
        organizationUnitId,
        false,
        { applyToAllFuture: true },
      );

      expect((await getShift(shift.id)).joinRequiresApproval).toBe(false);

      expect(await getInviteStatus(firstInvite.id)).toBe(
        ShiftInviteStatus.JOINED,
      );
      expect(await getInviteStatus(thirdInvite.id)).toBe(
        ShiftInviteStatus.JOINED,
      );
      // Untouched — its own override still requires approval.
      expect(await getInviteStatus(secondInvite.id)).toBe(
        ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
      );
    });
  });

  describe('guards', () => {
    it('throws NotFoundGraphQLError for a nonexistent instance', async () => {
      await expect(
        shiftService.updateShiftInstanceApproval(
          crypto.randomUUID(),
          organizationUnitId,
          true,
        ),
      ).rejects.toThrow(NotFoundGraphQLError);
    });

    it('throws NotFoundGraphQLError when the instance belongs to a different org unit', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: null,
      });
      const [instance] = await getShiftInstances(shift.id);

      await expect(
        shiftService.updateShiftInstanceApproval(
          instance.id,
          crypto.randomUUID(),
          true,
        ),
      ).rejects.toThrow(NotFoundGraphQLError);
    });

    it('throws ConflictGraphQLError for a past/ended instance', async () => {
      const shift = await createShift(db, {
        organizationUnitId,
        createdById: userId,
        startsAt: future(100000),
        endsAt: future(200000),
        rrule: null,
      });
      const [instance] = await getShiftInstances(shift.id);
      await db
        .update(schema.shiftInstances)
        .set({ actualEndsAt: new Date(Date.now() - 100000) })
        .where(eq(schema.shiftInstances.id, instance.id));

      await expect(
        shiftService.updateShiftInstanceApproval(
          instance.id,
          organizationUnitId,
          true,
        ),
      ).rejects.toThrow(ConflictGraphQLError);
    });
  });
});

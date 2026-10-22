jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'abcdefghijkl',
}));

import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../shared/observability/posthog.events';
import { PostHogService } from '../shared/observability/posthog.service';
import { AddTimeEntryInput } from './inputs/add-time-entry.input';
import { CloseTimeEntryInput } from './inputs/close-time-enty-input';
import { UpdateTimeEntryInput } from './inputs/update-time-entry.input';
import { TimeTrackingService } from './time-tracking.service';

const FAR_FUTURE = new Date('2099-01-01T00:00:00.000Z');

describe('TimeTrackingService.addTimeEntry PostHog', () => {
  it('captures with the volunteer as subject, not the admin actor', async () => {
    const capture = jest.fn();
    const db = {
      query: {
        shiftInstances: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'si-1',
            actualEndsAt: FAR_FUTURE,
            master: { organizationUnitId: 'ou-1' },
          }),
        },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'te-1',
              shiftInstanceId: 'si-1',
              volunteerId: 'volunteer-1',
            },
          ]),
        }),
      }),
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    const input = Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: 'si-1',
      volunteerId: 'volunteer-1',
      startedAt: new Date(),
      notes: null,
    });

    await service.addTimeEntry('ou-1', input, 'admin-1');

    expect(capture).toHaveBeenCalledWith({
      event: POSTHOG_EVENT.TIME_ENTRY_CREATE,
      userId: 'volunteer-1',
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_unit_id: 'ou-1',
        shift_instance_id: 'si-1',
      },
    });
  });
});

describe('TimeTrackingService.inviteVolunteerToOrganization PostHog', () => {
  it('captures organization_unit_invite for the volunteer after the email is queued', async () => {
    const capture = jest.fn();
    const notifyOrganizationUnitInvited = jest.fn();
    const db = {
      query: {
        organizationUnits: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'ou-1',
            name: 'Unit',
            organizationId: 'org-1',
          }),
        },
      },
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      {} as never,
      { capture } as unknown as PostHogService,
      {} as never,
      { findById: jest.fn().mockResolvedValue({ id: 'volunteer-1' }) } as never,
      { notifyOrganizationUnitInvited } as never,
      {} as never,
      { emit: jest.fn() } as never,
    );

    await service.inviteVolunteerToOrganization('ou-1', 'volunteer-1');

    expect(notifyOrganizationUnitInvited).toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith({
      event: POSTHOG_EVENT.ORGANIZATION_UNIT_INVITE,
      userId: 'volunteer-1',
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: 'org-1',
        organization_unit_id: 'ou-1',
        source: 'check_in',
      },
    });
  });
});

describe('TimeTrackingService.addTimeEntry reimbursement type', () => {
  it('inherits the instance override over the master shift type', async () => {
    const insertValues = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'te-1',
          shiftInstanceId: 'si-1',
          volunteerId: 'volunteer-1',
          reimbursementTypeId: 'override-type',
        },
      ]),
    });
    const db = {
      query: {
        shiftInstances: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'si-1',
            actualEndsAt: FAR_FUTURE,
            overrideReimbursementTypeId: 'override-type',
            master: {
              organizationUnitId: 'ou-1',
              reimbursementTypeId: 'master-type',
            },
          }),
        },
      },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    const input = Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: 'si-1',
      volunteerId: 'volunteer-1',
      startedAt: new Date(),
      notes: null,
    });

    await service.addTimeEntry('ou-1', input, 'admin-1');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        reimbursementTypeId: 'override-type',
      }),
    );
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty('isPaid');
  });

  it('falls back to the master shift type when the instance has no override', async () => {
    const insertValues = jest.fn().mockReturnValue({
      returning: jest
        .fn()
        .mockResolvedValue([
          { id: 'te-2', shiftInstanceId: 'si-2', volunteerId: 'volunteer-1' },
        ]),
    });
    const db = {
      query: {
        shiftInstances: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'si-2',
            actualEndsAt: FAR_FUTURE,
            overrideReimbursementTypeId: null,
            master: {
              organizationUnitId: 'ou-1',
              reimbursementTypeId: 'master-type',
            },
          }),
        },
      },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    const input = Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: 'si-2',
      volunteerId: 'volunteer-1',
      startedAt: new Date(),
      notes: null,
    });

    await service.addTimeEntry('ou-1', input, 'admin-1');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ reimbursementTypeId: 'master-type' }),
    );
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty('isPaid');
  });

  it('stays type-less for a shift with no reimbursement type', async () => {
    const insertValues = jest.fn().mockReturnValue({
      returning: jest
        .fn()
        .mockResolvedValue([
          { id: 'te-3', shiftInstanceId: 'si-3', volunteerId: 'volunteer-1' },
        ]),
    });
    const db = {
      query: {
        shiftInstances: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'si-3',
            actualEndsAt: FAR_FUTURE,
            overrideReimbursementTypeId: null,
            master: { organizationUnitId: 'ou-1', reimbursementTypeId: null },
          }),
        },
      },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    const input = Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: 'si-3',
      volunteerId: 'volunteer-1',
      startedAt: new Date(),
      notes: null,
    });

    await service.addTimeEntry('ou-1', input, 'admin-1');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ reimbursementTypeId: null }),
    );
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty('isPaid');
  });

  it('stays type-less for a shiftless entry (no shiftInstanceId)', async () => {
    const insertValues = jest.fn().mockReturnValue({
      returning: jest
        .fn()
        .mockResolvedValue([
          { id: 'te-4', shiftInstanceId: null, volunteerId: 'volunteer-1' },
        ]),
    });
    const db = {
      query: { shiftInstances: { findFirst: jest.fn() } },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {} as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    const input = Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: null,
      volunteerId: 'volunteer-1',
      startedAt: new Date(),
      notes: null,
    });

    await service.addTimeEntry('ou-1', input, 'admin-1');

    expect(db.query.shiftInstances.findFirst).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ reimbursementTypeId: null }),
    );
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty('isPaid');
  });
});

describe('TimeTrackingService.getCheckInReadiness without a shift', () => {
  const membershipService = () => ({
    isMemberOfUnitOrAncestor: jest.fn().mockResolvedValue(true),
    findPendingMembershipRequest: jest.fn().mockResolvedValue({ id: 'mr-1' }),
    findMembershipInUnits: jest.fn().mockResolvedValue(null),
  });
  const shiftService = () => ({
    findInstanceById: jest.fn().mockResolvedValue({
      id: 'si-1',
      overrideReimbursementTypeId: null,
      master: { reimbursementTypeId: null, organizationUnitId: 'ou-1' },
    }),
    findInviteStatusesForUser: jest.fn(),
    hasOpenTimeEntry: jest.fn(),
  });
  const organizationUnitDataService = () => ({
    listInclusiveAncestorUnitIds: jest.fn().mockResolvedValue(['ou-1']),
    findById: jest.fn().mockResolvedValue({ idVerificationEnabled: false }),
    findOrganizationByUnitId: jest.fn().mockResolvedValue(null),
  });

  it('reports the membership facts and skips the shift lookups', async () => {
    const shift = shiftService();
    const db = { query: {} };
    const service = new TimeTrackingService(
      db as never,
      membershipService() as never,
      shift as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      organizationUnitDataService() as never,
      { emit: jest.fn() } as never,
    );

    const readiness = await service.getCheckInReadiness(
      'volunteer-1',
      null,
      'ou-1',
    );

    expect(readiness).toMatchObject({
      isMember: true,
      openMembershipRequestId: 'mr-1',
      shiftInviteStatus: null,
      isParticipating: false,
      hasOpenTimeEntry: false,
      idVerificationEnabled: false,
      idVerified: false,
      membershipId: null,
    });
    expect(shift.findInstanceById).not.toHaveBeenCalled();
    expect(shift.findInviteStatusesForUser).not.toHaveBeenCalled();
    expect(shift.hasOpenTimeEntry).not.toHaveBeenCalled();
  });

  it('still queries the shift facts when an instance is given', async () => {
    const shift = shiftService();
    shift.findInviteStatusesForUser.mockResolvedValue([]);
    shift.hasOpenTimeEntry.mockResolvedValue(true);
    const db = { query: {} };
    const service = new TimeTrackingService(
      db as never,
      membershipService() as never,
      shift as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      organizationUnitDataService() as never,
      { emit: jest.fn() } as never,
    );

    await service.getCheckInReadiness('volunteer-1', 'si-1', 'ou-1');

    expect(shift.findInstanceById).toHaveBeenCalledWith('si-1', 'ou-1');
    expect(shift.findInviteStatusesForUser).toHaveBeenCalledWith(
      'volunteer-1',
      ['si-1'],
    );
    expect(shift.hasOpenTimeEntry).toHaveBeenCalledWith('si-1', 'volunteer-1');
  });
});

describe('TimeTrackingService.checkInVolunteer start time', () => {
  it('uses the given start time instead of now', async () => {
    const start = new Date('2026-09-28T08:00:00.000Z');
    const insertValues = jest.fn().mockReturnValue({
      returning: jest
        .fn()
        .mockResolvedValue([
          { id: 'te-1', shiftInstanceId: null, volunteerId: 'volunteer-1' },
        ]),
    });
    const db = {
      query: { shiftInstances: { findFirst: jest.fn() } },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {
        isMemberOfUnitOrAncestor: jest.fn().mockResolvedValue(true),
      } as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );

    await service.checkInVolunteer(
      'ou-1',
      'volunteer-1',
      null,
      'admin-1',
      start,
    );

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: start }),
    );
  });

  it('falls back to now when no start time is given', async () => {
    const before = new Date();
    const insertValues = jest.fn().mockReturnValue({
      returning: jest
        .fn()
        .mockResolvedValue([
          { id: 'te-2', shiftInstanceId: null, volunteerId: 'volunteer-1' },
        ]),
    });
    const db = {
      query: { shiftInstances: { findFirst: jest.fn() } },
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const service = new TimeTrackingService(
      db as never,
      {
        isMemberOfUnitOrAncestor: jest.fn().mockResolvedValue(true),
      } as never,
      { hasOpenTimeEntry: jest.fn().mockResolvedValue(false) } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );

    await service.checkInVolunteer(
      'ou-1',
      'volunteer-1',
      null,
      'admin-1',
      null,
    );

    const inserted = insertValues.mock.calls[0][0] as { startedAt: Date };
    expect(inserted.startedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });
});

describe('TimeTrackingService time validation', () => {
  const SHIFT_END = new Date('2026-10-22T18:00:00.000Z');
  const AFTER_SHIFT_END = new Date('2026-10-22T18:01:00.000Z');

  const instance = (actualEndsAt: Date) => ({
    id: 'si-1',
    actualEndsAt,
    overrideReimbursementTypeId: null,
    master: { organizationUnitId: 'ou-1', reimbursementTypeId: null },
  });

  const buildService = (overrides: {
    db?: Record<string, unknown>;
    membership?: Record<string, unknown>;
    shift?: Record<string, unknown>;
  }) => {
    const insertValues = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'te-1',
          shiftInstanceId: 'si-1',
          volunteerId: 'volunteer-1',
        },
      ]),
    });
    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest
          .fn()
          .mockResolvedValue([{ id: 'te-1', volunteerId: 'volunteer-1' }]),
      }),
    });
    const db = {
      query: {},
      insert: jest.fn().mockReturnValue({ values: insertValues }),
      update: jest.fn().mockReturnValue({ set: updateSet }),
      ...overrides.db,
    };
    const service = new TimeTrackingService(
      db as never,
      (overrides.membership ?? {}) as never,
      {
        hasOpenTimeEntry: jest.fn().mockResolvedValue(false),
        ...overrides.shift,
      } as never,
      { capture: jest.fn() } as unknown as PostHogService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    return { service, insertValues, updateSet };
  };

  const addInput = (
    startedAt: Date,
    endedAt?: Date | null,
  ): AddTimeEntryInput =>
    Object.assign(new AddTimeEntryInput(), {
      shiftInstanceId: 'si-1',
      volunteerId: 'volunteer-1',
      startedAt,
      endedAt,
      notes: null,
    });

  it('addTimeEntry rejects start after shift end', async () => {
    const { service, insertValues } = buildService({
      db: {
        query: {
          shiftInstances: {
            findFirst: jest.fn().mockResolvedValue(instance(SHIFT_END)),
          },
        },
      },
    });

    await expect(
      service.addTimeEntry('ou-1', addInput(AFTER_SHIFT_END), 'admin-1'),
    ).rejects.toThrow('Check-in cannot be later than the shift end');
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('addTimeEntry rejects end that is not after start', async () => {
    const { service, insertValues } = buildService({
      db: {
        query: {
          shiftInstances: {
            findFirst: jest.fn().mockResolvedValue(instance(SHIFT_END)),
          },
        },
      },
    });

    await expect(
      service.addTimeEntry(
        'ou-1',
        addInput(
          new Date('2026-10-22T10:00:00.000Z'),
          new Date('2026-10-22T10:00:00.000Z'),
        ),
        'admin-1',
      ),
    ).rejects.toThrow('Time entry must end after it starts');
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('addTimeEntry rejects end before start for a shiftless entry', async () => {
    const { service, insertValues } = buildService({});
    const input = addInput(
      new Date('2026-10-22T10:00:00.000Z'),
      new Date('2026-10-22T09:00:00.000Z'),
    );
    input.shiftInstanceId = null;

    await expect(
      service.addTimeEntry('ou-1', input, 'admin-1'),
    ).rejects.toThrow('Time entry must end after it starts');
    expect(insertValues).not.toHaveBeenCalled();
  });

  describe('updateTimeEntry', () => {
    const existing = {
      id: 'te-1',
      organizationUnitId: 'ou-1',
      shiftInstanceId: 'si-old',
      startedAt: new Date('2026-10-22T10:00:00.000Z'),
      endedAt: null,
    };

    it("rejects start after the new instance's end", async () => {
      const { service, updateSet } = buildService({
        db: {
          query: {
            timeEntries: { findFirst: jest.fn().mockResolvedValue(existing) },
            shiftInstances: {
              findFirst: jest.fn().mockResolvedValue(instance(SHIFT_END)),
            },
          },
        },
      });

      await expect(
        service.updateTimeEntry(
          'te-1',
          'ou-1',
          Object.assign(new UpdateTimeEntryInput(), {
            shiftInstanceId: 'si-1',
            startedAt: AFTER_SHIFT_END,
          }),
          'admin-1',
        ),
      ).rejects.toThrow('Check-in cannot be later than the shift end');
      expect(updateSet).not.toHaveBeenCalled();
    });

    it('validates against the existing instance when the input leaves it unchanged', async () => {
      const findInstance = jest.fn().mockResolvedValue(instance(SHIFT_END));
      const { service, updateSet } = buildService({
        db: {
          query: {
            timeEntries: { findFirst: jest.fn().mockResolvedValue(existing) },
            shiftInstances: { findFirst: findInstance },
          },
        },
      });

      await expect(
        service.updateTimeEntry(
          'te-1',
          'ou-1',
          Object.assign(new UpdateTimeEntryInput(), {
            startedAt: AFTER_SHIFT_END,
          }),
          'admin-1',
        ),
      ).rejects.toThrow('Check-in cannot be later than the shift end');
      expect(findInstance).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'si-old' } }),
      );
      expect(updateSet).not.toHaveBeenCalled();
    });

    it('skips the shift-end rule once the instance is cleared', async () => {
      const findInstance = jest.fn();
      const { service, updateSet } = buildService({
        db: {
          query: {
            timeEntries: { findFirst: jest.fn().mockResolvedValue(existing) },
            shiftInstances: { findFirst: findInstance },
          },
        },
      });

      await service.updateTimeEntry(
        'te-1',
        'ou-1',
        Object.assign(new UpdateTimeEntryInput(), {
          shiftInstanceId: null,
          startedAt: AFTER_SHIFT_END,
        }),
        'admin-1',
      );

      expect(findInstance).not.toHaveBeenCalled();
      expect(updateSet).toHaveBeenCalled();
    });

    it('rejects an end that is not after the new start, keeping the existing end when omitted', async () => {
      const { service, updateSet } = buildService({
        db: {
          query: {
            timeEntries: {
              findFirst: jest.fn().mockResolvedValue({
                ...existing,
                shiftInstanceId: null,
                endedAt: new Date('2026-10-22T11:00:00.000Z'),
              }),
            },
          },
        },
      });

      await expect(
        service.updateTimeEntry(
          'te-1',
          'ou-1',
          Object.assign(new UpdateTimeEntryInput(), {
            startedAt: new Date('2026-10-22T12:00:00.000Z'),
          }),
          'admin-1',
        ),
      ).rejects.toThrow('Time entry must end after it starts');
      expect(updateSet).not.toHaveBeenCalled();
    });
  });

  it('closeTimeEntry rejects end before start', async () => {
    const { service, updateSet } = buildService({
      db: {
        query: {
          timeEntries: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'te-1',
              organizationUnitId: 'ou-1',
              startedAt: new Date('2026-10-22T10:00:00.000Z'),
            }),
          },
        },
      },
    });

    await expect(
      service.closeTimeEntry(
        'te-1',
        'ou-1',
        Object.assign(new CloseTimeEntryInput(), {
          endedAt: new Date('2026-10-22T09:00:00.000Z'),
        }),
        'admin-1',
      ),
    ).rejects.toThrow('Time entry must end after it starts');
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('checkIn rejects after actualEndsAt', async () => {
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValue(SHIFT_END.getTime() + 60_000);
    try {
      const { service, insertValues } = buildService({
        membership: {
          isMemberOfUnitOrAncestor: jest.fn().mockResolvedValue(true),
        },
        shift: {
          findInstanceWithMaster: jest.fn().mockResolvedValue({
            ...instance(SHIFT_END),
            isCancelled: false,
            actualStartsAt: new Date('2026-10-22T14:00:00.000Z'),
          }),
        },
      });

      await expect(service.checkIn('si-1', 'volunteer-1')).rejects.toThrow(
        'Check-in is only available around the shift time',
      );
      expect(insertValues).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it('checkInVolunteer rejects explicit startedAt after shift end', async () => {
    const { service, insertValues } = buildService({
      db: {
        query: {
          shiftInstances: {
            findFirst: jest.fn().mockResolvedValue(instance(SHIFT_END)),
          },
        },
      },
      membership: {
        isMemberOfUnitOrAncestor: jest.fn().mockResolvedValue(true),
      },
    });

    await expect(
      service.checkInVolunteer(
        'ou-1',
        'volunteer-1',
        'si-1',
        'admin-1',
        AFTER_SHIFT_END,
      ),
    ).rejects.toThrow('Check-in cannot be later than the shift end');
    expect(insertValues).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, mock } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import { ShiftUnderstaffedNotificationService } from './shift-understaffed-notification.service';

// 2026-10-03 is a Saturday; 20:00Z is 22:00 Berlin, still Saturday.
const NOW = new Date('2026-10-03T08:00:00Z');
const SATURDAY_EVENING = new Date('2026-10-03T20:00:00Z');
const ORG_UNIT_ID = 'unit-1';

function instance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instance-1',
    masterId: 'shift-1',
    actualStartsAt: SATURDAY_EVENING,
    actualEndsAt: new Date('2026-10-03T22:00:00Z'),
    overrideMinVolunteers: null,
    overrideTitle: null,
    master: {
      id: 'shift-1',
      title: 'Saturday soup kitchen',
      organizationUnitId: ORG_UNIT_ID,
      minVolunteers: 3,
    },
    ...overrides,
  };
}

function build(options: {
  automation?: {
    enabled: boolean;
    activeDays: Weekday[];
    leadTimeHours: number | null;
  };
  instances?: ReturnType<typeof instance>[];
  filledCount?: number;
}) {
  const sendCallOut = mock(async () => ({ recipientCount: 4 }));
  const instances = options.instances ?? [instance()];

  const db = {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: async () => undefined }),
    }),
  };

  const service = new ShiftUnderstaffedNotificationService(
    db as never,
    {
      findUnderstaffedCandidateInstances: async () => instances,
      getFilledCounts: async () =>
        new Map(instances.map((entry) => [entry.id, options.filledCount ?? 0])),
    } as never,
    { sendCallOut } as never,
    { findUsersWithPermission: async () => [] } as never,
    { findById: async () => ({ id: ORG_UNIT_ID, name: 'Unit' }) } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      resolveMany: async () =>
        new Map([
          [
            ORG_UNIT_ID,
            options.automation ?? {
              enabled: true,
              activeDays: [Weekday.SATURDAY, Weekday.SUNDAY],
              leadTimeHours: 48,
            },
          ],
        ]),
    } as never,
  );

  return { service, sendCallOut };
}

describe('ShiftUnderstaffedNotificationService automatic urgent call', () => {
  it('sends the call-out when the unit has the automation on and the shift is covered', async () => {
    const { service, sendCallOut } = build({});

    const summary = await service.runTick(NOW);

    expect(sendCallOut).toHaveBeenCalledTimes(1);
    expect(summary.call_outs_fired).toBe(1);
    expect(summary.skipped_automation_off).toBe(0);
  });

  it('sends nothing for a unit that has not switched the automation on', async () => {
    const { service, sendCallOut } = build({
      automation: {
        enabled: false,
        activeDays: [Weekday.SATURDAY],
        leadTimeHours: 48,
      },
    });

    const summary = await service.runTick(NOW);

    expect(sendCallOut).not.toHaveBeenCalled();
    expect(summary.call_outs_fired).toBe(0);
    expect(summary.skipped_automation_off).toBe(1);
  });

  it('sends nothing when the shift falls outside the active days', async () => {
    const { service, sendCallOut } = build({
      automation: {
        enabled: true,
        activeDays: [Weekday.MONDAY],
        leadTimeHours: 48,
      },
    });

    await service.runTick(NOW);

    expect(sendCallOut).not.toHaveBeenCalled();
  });

  it('waits until the shift is inside the chosen lead time', async () => {
    const { service, sendCallOut } = build({
      automation: {
        enabled: true,
        activeDays: [Weekday.SATURDAY],
        leadTimeHours: 1,
      },
    });

    await service.runTick(NOW);

    expect(sendCallOut).not.toHaveBeenCalled();
  });

  it('reaches shifts further out than the old fixed 48 hours', async () => {
    // 2026-10-05T20:00Z is a Monday, 60 hours after NOW.
    const mondayInSixtyHours = [
      instance({ actualStartsAt: new Date('2026-10-05T20:00:00Z') }),
    ];

    const outside = build({
      automation: {
        enabled: true,
        activeDays: [Weekday.MONDAY],
        leadTimeHours: 48,
      },
      instances: mondayInSixtyHours,
    });
    await outside.service.runTick(NOW);
    expect(outside.sendCallOut).not.toHaveBeenCalled();

    const inside = build({
      automation: {
        enabled: true,
        activeDays: [Weekday.MONDAY],
        leadTimeHours: 72,
      },
      instances: mondayInSixtyHours,
    });
    await inside.service.runTick(NOW);
    expect(inside.sendCallOut).toHaveBeenCalledTimes(1);
  });

  it('never touches a shift without a minimum', async () => {
    const { service, sendCallOut } = build({
      instances: [
        instance({
          master: {
            id: 'shift-1',
            title: 'No minimum',
            organizationUnitId: ORG_UNIT_ID,
            minVolunteers: null,
          },
        }),
      ],
    });

    const summary = await service.runTick(NOW);

    expect(sendCallOut).not.toHaveBeenCalled();
    expect(summary.skipped_no_minimum).toBe(1);
  });

  it('sends nothing once the shift is back at its minimum', async () => {
    const { service, sendCallOut } = build({ filledCount: 3 });

    const summary = await service.runTick(NOW);

    expect(sendCallOut).not.toHaveBeenCalled();
    expect(summary.rearmed).toBe(1);
  });
});

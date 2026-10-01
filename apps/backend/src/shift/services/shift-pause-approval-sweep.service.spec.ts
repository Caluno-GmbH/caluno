import { describe, expect, it, mock } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import { ShiftPauseApprovalSweepService } from './shift-pause-approval-sweep.service';

// 2026-10-03 is a Saturday; 20:00Z is 22:00 Berlin, still Saturday.
const NOW = new Date('2026-10-03T08:00:00Z');
const SATURDAY_EVENING = new Date('2026-10-03T20:00:00Z');
const ORG_UNIT_ID = 'unit-1';

function instance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instance-1',
    masterId: 'shift-1',
    actualStartsAt: SATURDAY_EVENING,
    overrideMinVolunteers: null,
    overrideJoinRequiresApproval: null,
    master: {
      id: 'shift-1',
      organizationUnitId: ORG_UNIT_ID,
      minVolunteers: 3,
      joinRequiresApproval: true,
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
  sweepPausedApprovalInvites?: (instanceIds: string[]) => Promise<void>;
}) {
  const instances = options.instances ?? [instance()];
  const sweepPausedApprovalInvites =
    options.sweepPausedApprovalInvites ?? mock(async () => undefined);

  const service = new ShiftPauseApprovalSweepService(
    {
      findPauseApprovalSweepCandidates: async () => instances,
      getFilledCounts: async () =>
        new Map(instances.map((entry) => [entry.id, options.filledCount ?? 0])),
      sweepPausedApprovalInvites,
    } as never,
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

  return { service, sweepPausedApprovalInvites };
}

describe('ShiftPauseApprovalSweepService', () => {
  it('sweeps an understaffed instance inside the window', async () => {
    const { service, sweepPausedApprovalInvites } = build({});

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).toHaveBeenCalledTimes(1);
    expect(sweepPausedApprovalInvites).toHaveBeenCalledWith(['instance-1']);
    expect(summary).toMatchObject({
      candidates: 1,
      swept: 1,
      skipped_automation_off: 0,
      failed: 0,
    });
  });

  it('does nothing when there are no candidates', async () => {
    const { service, sweepPausedApprovalInvites } = build({ instances: [] });

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ candidates: 0, swept: 0 });
  });

  it('skips a unit that has not switched the automation on', async () => {
    const { service, sweepPausedApprovalInvites } = build({
      automation: {
        enabled: false,
        activeDays: [Weekday.SATURDAY],
        leadTimeHours: 48,
      },
    });

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      candidates: 1,
      swept: 0,
      skipped_automation_off: 1,
    });
  });

  it('leaves a shift alone once it has reached its minimum', async () => {
    const { service, sweepPausedApprovalInvites } = build({ filledCount: 3 });

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).not.toHaveBeenCalled();
    expect(summary.swept).toBe(0);
  });

  it('leaves a shift alone outside the active days', async () => {
    const { service, sweepPausedApprovalInvites } = build({
      automation: {
        enabled: true,
        activeDays: [Weekday.MONDAY],
        leadTimeHours: 48,
      },
    });

    await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).not.toHaveBeenCalled();
  });

  it('sweeps multiple qualifying instances in one call', async () => {
    const instances = [
      instance({ id: 'instance-1' }),
      instance({ id: 'instance-2', masterId: 'shift-2' }),
    ];
    const { service, sweepPausedApprovalInvites } = build({ instances });

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).toHaveBeenCalledWith([
      'instance-1',
      'instance-2',
    ]);
    expect(summary.swept).toBe(2);
  });

  it('reports a failed sweep without throwing', async () => {
    const boom = new Error('boom');
    const { service, sweepPausedApprovalInvites } = build({
      sweepPausedApprovalInvites: mock(async () => {
        throw boom;
      }),
    });

    const summary = await service.runTick(NOW);

    expect(sweepPausedApprovalInvites).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ candidates: 1, swept: 0, failed: 1 });
  });
});

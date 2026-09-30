import { describe, expect, it, mock } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import { VolunteerDigestService } from './volunteer-digest.service';

const SUNDAY_0800 = new Date('2026-10-04T06:00:00Z');
const SUNDAY_0900 = new Date('2026-10-04T07:00:00Z');
const SUNDAY_2200 = new Date('2026-10-04T20:00:00Z');
const MONDAY_0800 = new Date('2026-10-05T06:00:00Z');

const EMPTY_PAGE = { instances: [], total: 0 };

interface UnitPlan {
  id: string;
  activeDays: Weekday[];
  sendAtTime: string | null;
  members: string[];
}

function build(
  units: UnitPlan[],
  deletedUnitIds: string[] = [],
  alreadyClaimed: string[] = [],
) {
  const findMyShiftInstances = mock(async () => EMPTY_PAGE);
  const findAvailableShiftInstances = mock(async () => EMPTY_PAGE);
  const send = mock(async () => undefined);

  let recipientCall = 0;
  const db = {
    selectDistinct: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => {
            const unit = units[recipientCall % units.length];
            recipientCall += 1;
            return (unit?.members ?? []).map((userId) => ({ userId }));
          },
        }),
      }),
    }),
  };

  const service = new VolunteerDigestService(
    db as never,
    {
      findMyShiftInstances,
      findAvailableShiftInstances,
      findInviteStatusesForUser: async () => [],
      getFilledCounts: async () => new Map(),
    } as never,
    {
      findById: async (id: string) =>
        deletedUnitIds.includes(id)
          ? { id, name: `Unit ${id}`, deletedAt: new Date() }
          : { id, name: `Unit ${id}`, deletedAt: null },
    } as never,
    {
      claimRun: async (unitId: string) => !alreadyClaimed.includes(unitId),
      listEnabled: async () =>
        units.map((unit) => ({
          kind: 'DISCOVERY_EMAIL',
          organizationUnitId: unit.id,
          enabled: true,
          activeDays: unit.activeDays,
          leadTimeHours: null,
          sendAtTime: unit.sendAtTime,
        })),
    } as never,
    { resolveUserNotificationData: async () => null } as never,
    { send } as never,
    {} as never,
  );

  return { service, findMyShiftInstances, findAvailableShiftInstances, send };
}

const SUNDAY_UNIT: UnitPlan = {
  id: 'unit-1',
  activeDays: [Weekday.SUNDAY],
  sendAtTime: '08:00',
  members: ['volunteer-1'],
};

describe('VolunteerDigestService scheduling', () => {
  it('sends nothing on a day the unit did not select', async () => {
    const { service, findMyShiftInstances } = build([SUNDAY_UNIT]);

    const summary = await service.sendDigests(MONDAY_0800);

    expect(summary.due_units).toBe(0);
    expect(summary.recipients).toBe(0);
    expect(findMyShiftInstances).not.toHaveBeenCalled();
  });

  it('catches up on a later tick when the send time was missed', async () => {
    const { service, findMyShiftInstances } = build([SUNDAY_UNIT]);

    const summary = await service.sendDigests(SUNDAY_0900);

    expect(summary.due_units).toBe(1);
    expect(findMyShiftInstances).toHaveBeenCalled();
  });

  it('gives up once the catch-up window has passed', async () => {
    const { service } = build([SUNDAY_UNIT]);

    expect((await service.sendDigests(SUNDAY_2200)).due_units).toBe(0);
  });

  it('sends only once a day, however many ticks find it due', async () => {
    const { service, findMyShiftInstances } = build(
      [SUNDAY_UNIT],
      [],
      ['unit-1'],
    );

    const summary = await service.sendDigests(SUNDAY_0900);

    expect(summary.due_units).toBe(1);
    expect(summary.already_sent_today).toBe(1);
    expect(summary.recipients).toBe(0);
    expect(findMyShiftInstances).not.toHaveBeenCalled();
  });

  it('builds the email for the unit due on this tick', async () => {
    const { service, findMyShiftInstances } = build([SUNDAY_UNIT]);

    const summary = await service.sendDigests(SUNDAY_0800);

    expect(summary.due_units).toBe(1);
    expect(summary.recipients).toBe(1);
    expect(findMyShiftInstances).toHaveBeenCalled();
  });

  it('scopes the content to the unit that is sending', async () => {
    const { service, findMyShiftInstances, findAvailableShiftInstances } =
      build([SUNDAY_UNIT]);

    await service.sendDigests(SUNDAY_0800);

    for (const call of findMyShiftInstances.mock.calls) {
      expect(call.at(-1)).toEqual(['unit-1']);
    }
    expect(findAvailableShiftInstances.mock.calls[0]?.[3]).toEqual(['unit-1']);
  });

  it('treats each due unit separately, so a shared volunteer is reached once per unit', async () => {
    const { service } = build([
      SUNDAY_UNIT,
      { ...SUNDAY_UNIT, id: 'unit-2', members: ['volunteer-1'] },
    ]);

    const summary = await service.sendDigests(SUNDAY_0800);

    expect(summary.due_units).toBe(2);
    expect(summary.recipients).toBe(2);
  });

  it('does not email on behalf of a deleted unit', async () => {
    const { service, findMyShiftInstances } = build([SUNDAY_UNIT], ['unit-1']);

    const summary = await service.sendDigests(SUNDAY_0800);

    expect(summary.due_units).toBe(1);
    expect(summary.recipients).toBe(0);
    expect(findMyShiftInstances).not.toHaveBeenCalled();
  });

  it('honours a unit that sends on several days', async () => {
    const { service } = build([
      { ...SUNDAY_UNIT, activeDays: [Weekday.SUNDAY, Weekday.MONDAY] },
    ]);

    expect((await service.sendDigests(SUNDAY_0800)).due_units).toBe(1);
    expect((await service.sendDigests(MONDAY_0800)).due_units).toBe(1);
  });
});

import { VolunteerAllowanceState } from './volunteer-allowance';
import { VolunteerAllowanceService } from './volunteer-allowance.service';

const UNIT = 'unit-1';
const ORG = 'org-1';
const EHREN = 'type-ehren';
const UEBUNG = 'type-uebung';

type Usage = { id: string; remainingCents: number; limitCents: number };

function build({
  instance,
  contracts,
  usage,
  hourlyRateCents = 20_00,
}: {
  instance?: {
    reimbursementTypeId: string | null;
    start: string;
    end: string;
    unit?: string;
  } | null;
  contracts: Record<string, string[]>;
  usage: Record<string, Usage[]>;
  hourlyRateCents?: number;
}) {
  const findFirst = jest.fn(() =>
    Promise.resolve(
      instance
        ? {
            actualStartsAt: new Date(instance.start),
            actualEndsAt: new Date(instance.end),
            master: {
              organizationUnitId: instance.unit ?? UNIT,
              reimbursementTypeId: instance.reimbursementTypeId,
            },
          }
        : undefined,
    ),
  );
  const db = { query: { shiftInstances: { findFirst } } } as never;
  const membershipService = {
    getMembers: jest.fn(() =>
      Promise.resolve(Object.keys(usage).map((id) => ({ id }))),
    ),
  } as never;
  const findActiveContractTypeIds = jest.fn(() =>
    Promise.resolve(
      new Map(Object.entries(contracts).map(([id, t]) => [id, new Set(t)])),
    ),
  );
  const contractService = { findActiveContractTypeIds } as never;
  const reimbursementRateService = {
    getRosterYearlyUsage: jest.fn(() =>
      Promise.resolve(
        Object.entries(usage).map(([id, types]) => ({
          volunteer: { id },
          usageByType: types.map((t) => ({
            reimbursementType: { id: t.id },
            usedCents: t.limitCents - t.remainingCents,
            limitCents: t.limitCents,
            remainingCents: t.remainingCents,
          })),
        })),
      ),
    ),
    getEffectiveRateCents: jest.fn(() => Promise.resolve(hourlyRateCents)),
  } as never;

  return {
    service: new VolunteerAllowanceService(
      db,
      membershipService,
      contractService,
      reimbursementRateService,
    ),
    findActiveContractTypeIds,
  };
}

const call = (
  service: VolunteerAllowanceService,
  volunteerIds: string[],
  shiftInstanceId?: string,
) =>
  service.getVolunteerAllowanceStates({
    organizationId: ORG,
    organizationUnitId: UNIT,
    volunteerIds,
    shiftInstanceId,
  });

const ehren = (remainingCents: number): Usage => ({
  id: EHREN,
  remainingCents,
  limitCents: 840_00,
});

describe('VolunteerAllowanceService', () => {
  describe('paid shift instance', () => {
    const instance = {
      reimbursementTypeId: EHREN,
      start: '2026-09-10T08:00:00Z',
      end: '2026-09-10T12:00:00Z', // 4h × 20€ = 80€
    };

    it('projects the instance duration × rate against the remaining allowance', async () => {
      const { service } = build({
        instance,
        contracts: { a: [EHREN], b: [EHREN], c: [EHREN], d: [] },
        usage: {
          a: [ehren(500_00)],
          b: [ehren(70_00)],
          c: [ehren(85_00)],
          d: [ehren(500_00)],
        },
      });

      const result = await call(service, ['a', 'b', 'c', 'd'], 'inst-1');

      expect(result).toEqual([
        { volunteerId: 'a', state: VolunteerAllowanceState.ELIGIBLE },
        { volunteerId: 'b', state: VolunteerAllowanceState.WOULD_EXCEED },
        { volunteerId: 'c', state: VolunteerAllowanceState.NEARLY_EXHAUSTED },
        { volunteerId: 'd', state: VolunteerAllowanceState.NO_AGREEMENT },
      ]);
    });

    it('checks contracts against the instance period', async () => {
      const { service, findActiveContractTypeIds } = build({
        instance,
        contracts: {},
        usage: { a: [ehren(500_00)] },
      });

      await call(service, ['a'], 'inst-1');

      expect(findActiveContractTypeIds).toHaveBeenCalledWith(['a'], {
        start: new Date(instance.start),
        end: new Date(instance.end),
      });
    });

    it('ignores contracts of another allowance type', async () => {
      const { service } = build({
        instance,
        contracts: { a: [UEBUNG] },
        usage: { a: [ehren(500_00)] },
      });

      expect(await call(service, ['a'], 'inst-1')).toEqual([
        { volunteerId: 'a', state: VolunteerAllowanceState.NO_AGREEMENT },
      ]);
    });
  });

  describe('unpaid shift or no shift (person only)', () => {
    it('never reports WOULD_EXCEED, even at a fully used ceiling', async () => {
      const { service } = build({
        instance: {
          reimbursementTypeId: null,
          start: '2026-09-10T08:00:00Z',
          end: '2026-09-10T12:00:00Z',
        },
        contracts: { a: [EHREN] },
        usage: { a: [ehren(0)] },
      });

      expect(await call(service, ['a'], 'inst-1')).toEqual([
        { volunteerId: 'a', state: VolunteerAllowanceState.NEARLY_EXHAUSTED },
      ]);
    });

    it('is NO_AGREEMENT without any active contract', async () => {
      const { service } = build({
        contracts: {},
        usage: { a: [ehren(840_00)] },
      });

      expect(await call(service, ['a'])).toEqual([
        { volunteerId: 'a', state: VolunteerAllowanceState.NO_AGREEMENT },
      ]);
    });

    it('takes the most restrictive state across contract types', async () => {
      const { service } = build({
        contracts: { a: [EHREN, UEBUNG] },
        usage: {
          a: [
            ehren(840_00),
            { id: UEBUNG, remainingCents: 10_00, limitCents: 3000_00 },
          ],
        },
      });

      expect(await call(service, ['a'])).toEqual([
        { volunteerId: 'a', state: VolunteerAllowanceState.NEARLY_EXHAUSTED },
      ]);
    });
  });

  it('only returns members of the unit', async () => {
    const { service, findActiveContractTypeIds } = build({
      contracts: { a: [EHREN], outsider: [EHREN] },
      usage: { a: [ehren(840_00)] },
    });

    const result = await call(service, ['a', 'outsider']);

    expect(result.map((r) => r.volunteerId)).toEqual(['a']);
    expect(findActiveContractTypeIds).toHaveBeenCalledWith(['a'], undefined);
  });

  it('rejects an instance from another unit', async () => {
    const { service } = build({
      instance: {
        reimbursementTypeId: EHREN,
        start: '2026-09-10T08:00:00Z',
        end: '2026-09-10T12:00:00Z',
        unit: 'other-unit',
      },
      contracts: {},
      usage: { a: [ehren(840_00)] },
    });

    await expect(call(service, ['a'], 'inst-1')).rejects.toThrow(
      'Shift instance not found',
    );
  });
});

import { ReimbursementRateService } from './reimbursement-rate.service';

const ORGANIZATION_ID = 'org-1';
const EP_TYPE = {
  id: 'type-ep',
  key: 'ehrenamtspauschale',
  platformDefaultRateCents: 500,
  yearlyLimitCents: 84_000,
};
const UL_TYPE = {
  id: 'type-ul',
  key: 'uebungsleiterpauschale',
  platformDefaultRateCents: 800,
  yearlyLimitCents: 300_000,
};

interface RateRow {
  organizationUnitId: string | null;
  reimbursementTypeId: string;
  hourlyRateCents: number;
}

function buildService({
  ancestorChain,
  rates,
}: {
  ancestorChain: string[];
  rates: RateRow[];
}) {
  const db = {
    query: {
      reimbursementTypes: {
        findMany: () => Promise.resolve([EP_TYPE, UL_TYPE]),
      },
      reimbursementRates: {
        findMany: () => Promise.resolve(rates),
      },
    },
  } as never;
  const organizationUnitDataService = {
    listInclusiveAncestorUnitIds: () => Promise.resolve(ancestorChain),
  } as never;

  return new ReimbursementRateService(
    db,
    organizationUnitDataService,
    {} as never,
    {} as never,
  );
}

describe('ReimbursementRateService.getEffectiveRates', () => {
  it('reports the parent rate as the inherited fallback for a sub-org', async () => {
    const service = buildService({
      ancestorChain: ['sub-unit', 'root-unit'],
      rates: [
        {
          organizationUnitId: 'root-unit',
          reimbursementTypeId: EP_TYPE.id,
          hourlyRateCents: 1000,
        },
      ],
    });

    const rates = await service.getEffectiveRates(ORGANIZATION_ID, 'sub-unit');
    const ep = rates.find((rate) => rate.reimbursementType.id === EP_TYPE.id);

    expect(ep?.hourlyRateCents).toBe(1000);
    expect(ep?.inheritedRateCents).toBe(1000);
    expect(ep?.organizationUnitId).toBe('root-unit');
  });

  it('keeps a sub-org override while reporting the parent rate it overrides', async () => {
    const service = buildService({
      ancestorChain: ['sub-unit', 'root-unit'],
      rates: [
        {
          organizationUnitId: 'root-unit',
          reimbursementTypeId: EP_TYPE.id,
          hourlyRateCents: 1000,
        },
        {
          organizationUnitId: 'sub-unit',
          reimbursementTypeId: EP_TYPE.id,
          hourlyRateCents: 1200,
        },
      ],
    });

    const rates = await service.getEffectiveRates(ORGANIZATION_ID, 'sub-unit');
    const ep = rates.find((rate) => rate.reimbursementType.id === EP_TYPE.id);

    expect(ep?.hourlyRateCents).toBe(1200);
    expect(ep?.isOverride).toBe(true);
    expect(ep?.organizationUnitId).toBe('sub-unit');
    expect(ep?.inheritedRateCents).toBe(1000);
  });

  it('inherits through more than one level of nesting', async () => {
    const service = buildService({
      ancestorChain: ['grandchild-unit', 'child-unit', 'root-unit'],
      rates: [
        {
          organizationUnitId: 'root-unit',
          reimbursementTypeId: UL_TYPE.id,
          hourlyRateCents: 1500,
        },
      ],
    });

    const rates = await service.getEffectiveRates(
      ORGANIZATION_ID,
      'grandchild-unit',
    );
    const ul = rates.find((rate) => rate.reimbursementType.id === UL_TYPE.id);

    expect(ul?.hourlyRateCents).toBe(1500);
    expect(ul?.inheritedRateCents).toBe(1500);
  });

  it('falls back to the platform default when nothing in the chain sets a rate', async () => {
    const service = buildService({
      ancestorChain: ['sub-unit', 'root-unit'],
      rates: [],
    });

    const rates = await service.getEffectiveRates(ORGANIZATION_ID, 'sub-unit');
    const ep = rates.find((rate) => rate.reimbursementType.id === EP_TYPE.id);

    expect(ep?.hourlyRateCents).toBe(EP_TYPE.platformDefaultRateCents);
    expect(ep?.isOverride).toBe(false);
    expect(ep?.inheritedRateCents).toBe(EP_TYPE.platformDefaultRateCents);
  });
});

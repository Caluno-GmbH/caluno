import { describe, expect, it } from 'bun:test';
import { startOfAppDay } from '../../shift/utils/app-time';
import { ContractStatus } from '../enums';
import {
  ContractCover,
  type CoverageContract,
  type CoverageTarget,
  contractCountsAsCover,
  contractCoversInstant,
  coverageTargetsForTimeEntries,
  matchCoveringContracts,
} from './contract-coverage';

const VOLUNTEER = 'volunteer-1';
const TYPE = 'type-1';
const UNIT = 'unit-1';

let sequence = 0;
function contract(overrides: Partial<CoverageContract> = {}): CoverageContract {
  sequence += 1;
  return {
    id: `contract-${sequence}`,
    volunteerId: VOLUNTEER,
    reimbursementTypeId: TYPE,
    organizationUnitId: UNIT,
    contractStatus: ContractStatus.ACTIVE,
    // October 2026, Berlin bounds.
    periodStart: startOfAppDay(2026, 9, 1),
    periodEnd: startOfAppDay(2026, 10, 1),
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    ...overrides,
  };
}

function target(
  at: Date,
  overrides: Partial<CoverageTarget> = {},
): CoverageTarget {
  return {
    key: 'entry-1',
    volunteerId: VOLUNTEER,
    reimbursementTypeId: TYPE,
    organizationUnitId: UNIT,
    at,
    ...overrides,
  };
}

/** 12:00 Berlin wall time is 10:00Z in summer and 11:00Z in winter; noon is far from any day bound either way. */
function berlinNoon(year: number, month: number, day: number): Date {
  return new Date(startOfAppDay(year, month, day).getTime() + 12 * 3_600_000);
}

describe('contractCountsAsCover', () => {
  it('counts only ACTIVE as active cover', () => {
    expect(
      contractCountsAsCover(ContractStatus.ACTIVE, ContractCover.ACTIVE),
    ).toBe(true);
    for (const status of [
      ContractStatus.DRAFT,
      ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      ContractStatus.AWAITING_NGO_SIGNATURE,
      ContractStatus.EXPIRED,
      ContractStatus.DECLINED,
    ]) {
      expect(contractCountsAsCover(status, ContractCover.ACTIVE)).toBe(false);
    }
  });

  it('counts every status except DECLINED as open cover', () => {
    for (const status of [
      ContractStatus.DRAFT,
      ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      ContractStatus.AWAITING_NGO_SIGNATURE,
      ContractStatus.ACTIVE,
      ContractStatus.EXPIRED,
    ]) {
      expect(contractCountsAsCover(status, ContractCover.OPEN)).toBe(true);
    }
    expect(
      contractCountsAsCover(ContractStatus.DECLINED, ContractCover.OPEN),
    ).toBe(false);
  });
});

describe('contractCoversInstant', () => {
  const october = contract();

  it('covers the first instant of the period', () => {
    expect(contractCoversInstant(october, october.periodStart)).toBe(true);
  });

  it('covers the last instant before the period ends', () => {
    expect(
      contractCoversInstant(october, new Date(october.periodEnd.getTime() - 1)),
    ).toBe(true);
  });

  it('does not cover an instant exactly on periodEnd', () => {
    expect(contractCoversInstant(october, october.periodEnd)).toBe(false);
  });

  it('does not cover an instant before the period starts', () => {
    expect(
      contractCoversInstant(
        october,
        new Date(october.periodStart.getTime() - 1),
      ),
    ).toBe(false);
  });
});

describe('matchCoveringContracts', () => {
  it('returns the week contract an entry falls inside', () => {
    // 05.10. to 11.10.2026 inclusive.
    const week = contract({
      periodStart: startOfAppDay(2026, 9, 5),
      periodEnd: startOfAppDay(2026, 9, 12),
    });
    const result = matchCoveringContracts(
      [week],
      [target(berlinNoon(2026, 9, 7))],
      ContractCover.ACTIVE,
    );
    expect(result.get('entry-1')?.map((c) => c.id)).toEqual([week.id]);
  });

  it('returns two overlapping contracts newest first', () => {
    const older = contract({ createdAt: new Date('2026-09-01T10:00:00.000Z') });
    const newer = contract({ createdAt: new Date('2026-09-20T10:00:00.000Z') });
    const result = matchCoveringContracts(
      [older, newer],
      [target(berlinNoon(2026, 9, 15))],
      ContractCover.ACTIVE,
    );
    expect(result.get('entry-1')?.map((c) => c.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it('orders contracts with the same createdAt the same way regardless of input order', () => {
    const createdAt = new Date('2026-09-01T10:00:00.000Z');
    const a = contract({ id: 'aaa', createdAt });
    const b = contract({ id: 'bbb', createdAt });
    const at = [target(berlinNoon(2026, 9, 15))];
    const forward = matchCoveringContracts([a, b], at, ContractCover.ACTIVE);
    const reversed = matchCoveringContracts([b, a], at, ContractCover.ACTIVE);
    expect(forward.get('entry-1')?.map((c) => c.id)).toEqual(['bbb', 'aaa']);
    expect(reversed.get('entry-1')?.map((c) => c.id)).toEqual(['bbb', 'aaa']);
  });

  it('does not cover an entry starting exactly on periodEnd', () => {
    const october = contract();
    const result = matchCoveringContracts(
      [october],
      [target(october.periodEnd)],
      ContractCover.ACTIVE,
    );
    expect(result.get('entry-1')).toEqual([]);
  });

  it('keeps the key with an empty list for an entry outside every contract', () => {
    const result = matchCoveringContracts(
      [contract()],
      [target(berlinNoon(2026, 11, 3))],
      ContractCover.ACTIVE,
    );
    expect(result.has('entry-1')).toBe(true);
    expect(result.get('entry-1')).toEqual([]);
  });

  it('covers entries in both years of a Sep 2026 to Mar 2027 contract', () => {
    const crossYear = contract({
      periodStart: startOfAppDay(2026, 8, 1),
      periodEnd: startOfAppDay(2027, 3, 1),
    });
    const result = matchCoveringContracts(
      [crossYear],
      [
        target(berlinNoon(2026, 11, 15), { key: 'december' }),
        target(berlinNoon(2027, 0, 15), { key: 'january' }),
        target(berlinNoon(2027, 3, 1), { key: 'april' }),
      ],
      ContractCover.ACTIVE,
    );
    expect(result.get('december')?.map((c) => c.id)).toEqual([crossYear.id]);
    expect(result.get('january')?.map((c) => c.id)).toEqual([crossYear.id]);
    expect(result.get('april')).toEqual([]);
  });

  it('covers the whole 25-hour day when clocks go back', () => {
    // Sunday 25.10.2026 is 25 hours long in Berlin.
    const dstDay = contract({
      periodStart: startOfAppDay(2026, 9, 25),
      periodEnd: startOfAppDay(2026, 9, 26),
    });
    const lastHour = new Date(dstDay.periodEnd.getTime() - 30 * 60_000);
    expect(dstDay.periodEnd.getTime() - dstDay.periodStart.getTime()).toBe(
      25 * 3_600_000,
    );
    const result = matchCoveringContracts(
      [dstDay],
      [
        target(lastHour, { key: 'late' }),
        target(dstDay.periodEnd, { key: 'next-day' }),
      ],
      ContractCover.ACTIVE,
    );
    expect(result.get('late')?.map((c) => c.id)).toEqual([dstDay.id]);
    expect(result.get('next-day')).toEqual([]);
  });

  it('ignores a declined contract for both kinds of cover', () => {
    const declined = contract({ contractStatus: ContractStatus.DECLINED });
    const at = [target(berlinNoon(2026, 9, 15))];
    expect(
      matchCoveringContracts([declined], at, ContractCover.ACTIVE).get(
        'entry-1',
      ),
    ).toEqual([]);
    expect(
      matchCoveringContracts([declined], at, ContractCover.OPEN).get('entry-1'),
    ).toEqual([]);
  });

  it('counts draft and awaiting-signature contracts as open cover only', () => {
    const draft = contract({ contractStatus: ContractStatus.DRAFT });
    const awaiting = contract({
      contractStatus: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      createdAt: new Date('2026-09-02T10:00:00.000Z'),
    });
    const at = [target(berlinNoon(2026, 9, 15))];
    expect(
      matchCoveringContracts([draft, awaiting], at, ContractCover.ACTIVE).get(
        'entry-1',
      ),
    ).toEqual([]);
    expect(
      matchCoveringContracts([draft, awaiting], at, ContractCover.OPEN)
        .get('entry-1')
        ?.map((c) => c.id),
    ).toEqual([awaiting.id, draft.id]);
  });

  it('ignores contracts for another volunteer, type or unit, and contracts without a unit', () => {
    const others = [
      contract({ volunteerId: 'volunteer-2' }),
      contract({ reimbursementTypeId: 'type-2' }),
      contract({ organizationUnitId: 'unit-2' }),
      contract({ organizationUnitId: null }),
    ];
    const result = matchCoveringContracts(
      others,
      [target(berlinNoon(2026, 9, 15))],
      ContractCover.ACTIVE,
    );
    expect(result.get('entry-1')).toEqual([]);
  });

  it('resolves each target against its own volunteer', () => {
    const mine = contract();
    const theirs = contract({ volunteerId: 'volunteer-2' });
    const result = matchCoveringContracts(
      [mine, theirs],
      [
        target(berlinNoon(2026, 9, 15), { key: 'mine' }),
        target(berlinNoon(2026, 9, 15), {
          key: 'theirs',
          volunteerId: 'volunteer-2',
        }),
      ],
      ContractCover.ACTIVE,
    );
    expect(result.get('mine')?.map((c) => c.id)).toEqual([mine.id]);
    expect(result.get('theirs')?.map((c) => c.id)).toEqual([theirs.id]);
  });

  it('throws when one key is used for two different targets', () => {
    expect(() =>
      matchCoveringContracts(
        [contract()],
        [
          target(berlinNoon(2026, 9, 3), { key: 'same' }),
          target(berlinNoon(2026, 11, 3), { key: 'same' }),
        ],
        ContractCover.ACTIVE,
      ),
    ).toThrow(/same/);
  });

  it('accepts the same key repeated for an identical target', () => {
    const october = contract();
    const at = berlinNoon(2026, 9, 3);
    const result = matchCoveringContracts(
      [october],
      [target(at, { key: 'same' }), target(new Date(at), { key: 'same' })],
      ContractCover.ACTIVE,
    );
    expect(result.get('same')?.map((c) => c.id)).toEqual([october.id]);
  });

  it('returns an empty map for no targets', () => {
    expect(
      matchCoveringContracts([contract()], [], ContractCover.ACTIVE).size,
    ).toBe(0);
  });
});

describe('coverageTargetsForTimeEntries', () => {
  it('keys each target by the entry id and anchors it on startedAt', () => {
    const startedAt = berlinNoon(2026, 9, 15);
    expect(
      coverageTargetsForTimeEntries([
        {
          id: 'entry-9',
          volunteerId: VOLUNTEER,
          reimbursementTypeId: TYPE,
          organizationUnitId: UNIT,
          startedAt,
        },
      ]),
    ).toEqual([
      {
        key: 'entry-9',
        volunteerId: VOLUNTEER,
        reimbursementTypeId: TYPE,
        organizationUnitId: UNIT,
        at: startedAt,
      },
    ]);
  });

  it('skips entries without a reimbursement type, which need no contract', () => {
    expect(
      coverageTargetsForTimeEntries([
        {
          id: 'unpaid',
          volunteerId: VOLUNTEER,
          reimbursementTypeId: null,
          organizationUnitId: UNIT,
          startedAt: berlinNoon(2026, 9, 15),
        },
      ]),
    ).toEqual([]);
  });
});

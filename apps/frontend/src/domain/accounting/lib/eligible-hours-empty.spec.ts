import { describe, expect, it } from 'bun:test';
import { eligibleHoursEmptyReason } from './eligible-hours-empty';

describe('eligibleHoursEmptyReason', () => {
  it('returns null while hours are listed', () => {
    expect(
      eligibleHoursEmptyReason({
        listedCount: 2,
        anyPeriodCount: 2,
        otherTypeKeysInPeriod: [],
      }),
    ).toBeNull();
  });

  it('returns null while any input is still loading', () => {
    expect(
      eligibleHoursEmptyReason({
        listedCount: 0,
        anyPeriodCount: undefined,
        otherTypeKeysInPeriod: [],
      }),
    ).toBeNull();
    expect(
      eligibleHoursEmptyReason({
        listedCount: 0,
        anyPeriodCount: 0,
        otherTypeKeysInPeriod: undefined,
      }),
    ).toBeNull();
  });

  it('points at the billing period when hours exist outside it', () => {
    expect(
      eligibleHoursEmptyReason({
        listedCount: 0,
        anyPeriodCount: 3,
        otherTypeKeysInPeriod: ['ul'],
      }),
    ).toEqual({ kind: 'outside-period', count: 3 });
  });

  it('points at the allowance type when the period only has other-type hours', () => {
    expect(
      eligibleHoursEmptyReason({
        listedCount: 0,
        anyPeriodCount: 0,
        otherTypeKeysInPeriod: ['ul', 'ul'],
      }),
    ).toEqual({ kind: 'other-type', reimbursementTypeKeys: ['ul'] });
  });

  it('says nothing is tracked otherwise', () => {
    expect(
      eligibleHoursEmptyReason({
        listedCount: 0,
        anyPeriodCount: 0,
        otherTypeKeysInPeriod: [],
      }),
    ).toEqual({ kind: 'nothing-tracked' });
  });
});

import { describe, expect, it } from 'bun:test';
import {
  billingMonthOf,
  billingYearBounds,
  fromPeriodBounds,
  toPeriodBounds,
} from './billing-period';

describe('toPeriodBounds', () => {
  it('stores picked calendar days as Berlin midnight with an exclusive end', () => {
    expect(
      toPeriodBounds({
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 30),
      }),
    ).toEqual({
      periodStart: '2026-08-31T22:00:00.000Z',
      periodEnd: '2026-09-30T22:00:00.000Z',
    });
  });

  it('treats a single picked day as that whole day', () => {
    expect(toPeriodBounds({ from: new Date(2026, 0, 15) })).toEqual({
      periodStart: '2026-01-14T23:00:00.000Z',
      periodEnd: '2026-01-15T23:00:00.000Z',
    });
  });

  it('returns undefined without a start day', () => {
    expect(toPeriodBounds({ from: undefined })).toBeUndefined();
  });
});

describe('fromPeriodBounds', () => {
  it('turns stored bounds back into the picked calendar days', () => {
    expect(
      fromPeriodBounds('2026-08-31T22:00:00.000Z', '2026-09-30T22:00:00.000Z'),
    ).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) });
  });
});

describe('billingYearBounds', () => {
  it('bounds a year at Berlin midnight', () => {
    expect(billingYearBounds(2026)).toEqual({
      periodStart: '2025-12-31T23:00:00.000Z',
      periodEnd: '2026-12-31T23:00:00.000Z',
    });
  });
});

describe('billingMonthOf', () => {
  it('reads the month in Berlin time', () => {
    expect(billingMonthOf('2026-09-30T22:30:00.000Z')).toEqual({
      year: 2026,
      month: 9,
    });
    expect(billingMonthOf('2025-12-31T23:00:00.000Z')).toEqual({
      year: 2026,
      month: 0,
    });
  });
});

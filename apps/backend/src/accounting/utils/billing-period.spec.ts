import { describe, expect, it } from 'bun:test';
import {
  billingMonthBoundsOf,
  billingYearBounds,
  billingYearOf,
  lastDayOfPeriod,
  periodCovers,
  periodsOverlap,
} from './billing-period';

describe('billing periods (Europe/Berlin calendar days, exclusive end)', () => {
  it('bounds a year at Berlin midnight', () => {
    expect(billingYearBounds(2026)).toEqual({
      start: new Date('2025-12-31T23:00:00.000Z'),
      end: new Date('2026-12-31T23:00:00.000Z'),
    });
  });

  it('bounds the Berlin month of an instant, across a DST change', () => {
    // 30 Sep 23:30 UTC is already 1 Oct in Berlin; October ends in winter time.
    expect(billingMonthBoundsOf(new Date('2026-09-30T23:30:00.000Z'))).toEqual({
      start: new Date('2026-09-30T22:00:00.000Z'),
      end: new Date('2026-10-31T23:00:00.000Z'),
    });
  });

  it('rolls December over into the next year', () => {
    expect(billingMonthBoundsOf(new Date('2026-12-15T10:00:00.000Z'))).toEqual({
      start: new Date('2026-11-30T23:00:00.000Z'),
      end: new Date('2026-12-31T23:00:00.000Z'),
    });
  });

  it('takes the year in Berlin time', () => {
    expect(billingYearOf(new Date('2025-12-31T23:00:00.000Z'))).toBe(2026);
    expect(billingYearOf(new Date('2025-12-31T22:59:59.999Z'))).toBe(2025);
  });

  it('returns the last instant a period still includes', () => {
    expect(lastDayOfPeriod(new Date('2026-09-30T22:00:00.000Z'))).toEqual(
      new Date('2026-09-30T21:59:59.999Z'),
    );
  });
});

describe('periodCovers', () => {
  const augStart = new Date('2026-07-31T22:00:00.000Z');
  const augEnd = new Date('2026-08-31T22:00:00.000Z');
  const sepEnd = new Date('2026-09-30T22:00:00.000Z');

  it('covers an instant inside the period', () => {
    expect(
      periodCovers(
        augStart,
        augEnd,
        new Date('2026-08-15T12:00:00.000Z'),
        new Date('2026-08-15T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('does not cover an instant after the period', () => {
    expect(
      periodCovers(
        augStart,
        augEnd,
        new Date('2026-09-15T12:00:00.000Z'),
        new Date('2026-09-15T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('does not cover an instant exactly at the exclusive end', () => {
    expect(periodCovers(augStart, augEnd, augEnd, augEnd)).toBe(false);
  });

  it('requires full coverage, not mere overlap', () => {
    // August contract vs a two-month (August–September) target: overlap but no cover.
    expect(periodCovers(augStart, augEnd, augStart, sepEnd)).toBe(false);
    expect(periodCovers(augStart, sepEnd, augStart, sepEnd)).toBe(true);
  });

  it('overlaps when the periods share any instant', () => {
    expect(periodsOverlap(augStart, augEnd, augEnd, sepEnd)).toBe(false);
    expect(
      periodsOverlap(
        augStart,
        sepEnd,
        augEnd,
        new Date('2026-10-31T23:00:00.000Z'),
      ),
    ).toBe(true);
  });
});

import { TZDate } from '@date-fns/tz';
import { ContractStatus } from '@repo/data';
import { isAfter, isBefore, isEqual } from 'date-fns';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import type { DateRange } from '../components/period-picker';

/**
 * Document periods are Europe/Berlin calendar days: `periodStart` is Berlin
 * midnight of the first day and `periodEnd` Berlin midnight of the day after
 * the last day (exclusive). The period picker works in calendar days, so these
 * convert between the two regardless of the browser's own timezone.
 */
export type PeriodBounds = { periodStart: string; periodEnd: string };

/** A half-open interval as concrete dates, for in-memory comparisons. */
export type DateInterval = { start: Date; end: Date };

function berlinMidnight(year: number, month: number, day: number): string {
  return new Date(
    new TZDate(year, month, day, DEFAULT_TIMEZONE).getTime(),
  ).toISOString();
}

/** A picked range of calendar days as stored bounds; a single day is that whole day. */
export function toPeriodBounds(range: DateRange): PeriodBounds | undefined {
  if (!range.from) return undefined;
  const from = range.from;
  const to = range.to ?? range.from;
  return {
    periodStart: berlinMidnight(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
    ),
    periodEnd: berlinMidnight(
      to.getFullYear(),
      to.getMonth(),
      to.getDate() + 1,
    ),
  };
}

/** Stored bounds as the calendar days the picker shows. */
export function fromPeriodBounds(
  periodStart: Date | string,
  periodEnd: Date | string,
): DateRange {
  const start = new TZDate(new Date(periodStart).getTime(), DEFAULT_TIMEZONE);
  const last = new TZDate(new Date(periodEnd).getTime() - 1, DEFAULT_TIMEZONE);
  return {
    from: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
    to: new Date(last.getFullYear(), last.getMonth(), last.getDate()),
  };
}

/** A Berlin calendar year as stored bounds. */
export function billingYearBounds(year: number): PeriodBounds {
  return {
    periodStart: berlinMidnight(year, 0, 1),
    periodEnd: berlinMidnight(year + 1, 0, 1),
  };
}

/** A Berlin calendar month as stored bounds. `month` is 0-based. */
export function billingMonthBounds(year: number, month: number): PeriodBounds {
  return {
    periodStart: berlinMidnight(year, month, 1),
    periodEnd: berlinMidnight(year, month + 1, 1),
  };
}

/**
 * Whether two half-open periods `[aStart, aEnd)` and `[bStart, bEnd)` overlap.
 */
export function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart);
}

/**
 * Whether the contract period `[cStart, cEnd)` fully covers the target period
 * `[tStart, tEnd)`. A period covers an instant when `tStart === tEnd`. Full
 * coverage (not mere overlap) is what stops a contract for one month from
 * covering a multi-month timesheet (VOLI-1370).
 */
export function periodCovers(
  cStart: Date | string,
  cEnd: Date | string,
  tStart: Date | string,
  tEnd: Date | string,
): boolean {
  const contractStart = new Date(cStart);
  const contractEnd = new Date(cEnd);
  const targetStart = new Date(tStart);
  const targetEnd = new Date(tEnd);
  return (
    !isAfter(contractStart, targetStart) &&
    isAfter(contractEnd, targetStart) &&
    !isBefore(contractEnd, targetEnd)
  );
}

/** How a stored contract period reads: a whole year, a whole month, or a day range. */
export type ContractPeriodKind = 'year' | 'month' | 'range';

export function contractPeriodKind(
  periodStart: Date | string,
  periodEnd: Date | string,
): ContractPeriodKind {
  const start = billingMonthOf(periodStart);
  const last = billingMonthOf(new Date(new Date(periodEnd).getTime() - 1));
  if (start.year === last.year && start.month === last.month) {
    const bounds = billingMonthBounds(start.year, start.month);
    return isEqual(new Date(periodStart), new Date(bounds.periodStart)) &&
      isEqual(new Date(periodEnd), new Date(bounds.periodEnd))
      ? 'month'
      : 'range';
  }
  if (start.year === last.year && start.month === 0 && last.month === 11) {
    const bounds = billingYearBounds(start.year);
    return isEqual(new Date(periodStart), new Date(bounds.periodStart)) &&
      isEqual(new Date(periodEnd), new Date(bounds.periodEnd))
      ? 'year'
      : 'range';
  }
  return 'range';
}

/**
 * A contract is only valid for the period it states. Nothing moves an ACTIVE
 * row to EXPIRED yet (no expiry job), so an ACTIVE contract whose period has
 * already ended is treated as expired (VOLI-1370).
 */
export function isContractExpired(
  status: ContractStatus,
  periodEnd: Date | string,
  referenceDate: Date,
): boolean {
  return (
    status === ContractStatus.Active &&
    !isAfter(new Date(periodEnd), referenceDate)
  );
}

/** The Berlin calendar month (0-based) a stored instant falls in. */
export function billingMonthOf(date: Date | string): {
  year: number;
  month: number;
} {
  const berlin = new TZDate(new Date(date).getTime(), DEFAULT_TIMEZONE);
  return { year: berlin.getFullYear(), month: berlin.getMonth() };
}

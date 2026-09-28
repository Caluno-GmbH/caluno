import { appDateParts, startOfAppDay } from '../../shift/utils/app-time';

/**
 * Document periods (invoices, contracts) are Europe/Berlin calendar days:
 * `periodStart` is Berlin midnight of the first day and `periodEnd` Berlin
 * midnight of the day after the last day, so a period contains `t` when
 * `periodStart <= t < periodEnd`.
 */
export type BillingPeriod = { start: Date; end: Date };

/** The calendar year in Berlin, e.g. for a contract or the Jahresdeckel. */
export function billingYearBounds(year: number): BillingPeriod {
  return {
    start: startOfAppDay(year, 0, 1),
    end: startOfAppDay(year + 1, 0, 1),
  };
}

/** The Berlin calendar month an instant falls in. */
export function billingMonthBoundsOf(instant: Date): BillingPeriod {
  const { year, month } = appDateParts(instant);
  return {
    start: startOfAppDay(year, month, 1),
    end: startOfAppDay(year, month + 1, 1),
  };
}

/** The Berlin calendar year an instant falls in. */
export function billingYearOf(instant: Date): number {
  return appDateParts(instant).year;
}

/** Whether two half-open periods `[aStart, aEnd)` and `[bStart, bEnd)` overlap. */
export function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/**
 * Whether the contract period `[cStart, cEnd)` fully covers the target period
 * `[tStart, tEnd)`. A period covers an instant when `tStart === tEnd`. Requiring
 * full coverage (not mere overlap) is what stops a contract for one month from
 * covering a multi-month timesheet (VOLI-1370).
 */
export function periodCovers(
  cStart: Date,
  cEnd: Date,
  tStart: Date,
  tEnd: Date,
): boolean {
  return (
    cStart.getTime() <= tStart.getTime() &&
    cEnd.getTime() > tStart.getTime() &&
    cEnd.getTime() >= tEnd.getTime()
  );
}

/** The last instant a period still contains; format it as the period's last day. */
export function lastDayOfPeriod(periodEnd: Date): Date {
  return new Date(periodEnd.getTime() - 1);
}

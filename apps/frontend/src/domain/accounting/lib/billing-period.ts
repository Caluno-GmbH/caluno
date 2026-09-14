import { TZDate } from '@date-fns/tz';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import type { DateRange } from '../components/period-picker';

/**
 * Document periods are Europe/Berlin calendar days: `periodStart` is Berlin
 * midnight of the first day and `periodEnd` Berlin midnight of the day after
 * the last day (exclusive). The period picker works in calendar days, so these
 * convert between the two regardless of the browser's own timezone.
 */
export type PeriodBounds = { periodStart: string; periodEnd: string };

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

/** The Berlin calendar month (0-based) a stored instant falls in. */
export function billingMonthOf(date: Date | string): {
  year: number;
  month: number;
} {
  const berlin = new TZDate(new Date(date).getTime(), DEFAULT_TIMEZONE);
  return { year: berlin.getFullYear(), month: berlin.getMonth() };
}

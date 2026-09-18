import type { EligibleTimeEntry } from '@repo/data';
import type { EligibleHourLine } from '../components/eligible-hours-card';
import {
  billingMonthBounds,
  billingYearBounds,
  type PeriodBounds,
  toPeriodBounds,
} from './billing-period';

const RANGE_PATTERN =
  /^(\d{2})\.(\d{2})\.(\d{4})\s*[–-]\s*(\d{2})\.(\d{2})\.(\d{4})$/;
const MONTH_PATTERN = /^(\d{2})\/(\d{4})$/;
const YEAR_PATTERN = /^(\d{4})$/;

/**
 * The period the contract's manual "Vertragslaufzeit" field states. The field
 * is the same "period" value the template builder produces, so it can be a
 * single month ("08/2026"), a whole year ("2026") or a day range
 * ("01.08.2026–15.08.2026"). The contract row must cover exactly what the
 * signed agreement states — a month agreement is valid for that month only
 * (VOLI-1370).
 */
function parseLifespan(lifespan: string): PeriodBounds | undefined {
  const range = lifespan.match(RANGE_PATTERN);
  if (range) {
    const [, fromDay, fromMonth, fromYear, toDay, toMonth, toYear] = range;
    return toPeriodBounds({
      from: new Date(Number(fromYear), Number(fromMonth) - 1, Number(fromDay)),
      to: new Date(Number(toYear), Number(toMonth) - 1, Number(toDay)),
    });
  }

  const month = lifespan.match(MONTH_PATTERN);
  if (month) return billingMonthBounds(Number(month[2]), Number(month[1]) - 1);

  const year = lifespan.match(YEAR_PATTERN);
  if (year) return billingYearBounds(Number(year[1]));

  return undefined;
}

/**
 * The validity period for a contract created with the given "Vertragslaufzeit"
 * string. Returns `undefined` when the string is empty or not a period we can
 * read, so the caller blocks creation with a clear message instead of silently
 * persisting a whole-year contract (VOLI-1370).
 */
export function contractPeriodForLifespan(
  lifespan: string,
): PeriodBounds | undefined {
  return parseLifespan(lifespan.trim());
}

/** Hours between two ISO timestamps, rounded to hundredths so display never shows floating-point noise. */
export function hoursBetween(startedAt: string, endedAt: string): number {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Maps a real eligible time entry (from `useEligibleTimeEntriesForInvoice`) to
 * the invoice modal's `EligibleHourLine` row shape — the same shape the
 * previous mock data used, so `EligibleHoursCard`'s check/uncheck behavior
 * keeps working unchanged.
 */
export function mapEligibleTimeEntry(
  entry: EligibleTimeEntry,
  formatting: {
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
    formatTime: (date: Date) => string;
  },
): EligibleHourLine {
  const { formatDate, formatTime } = formatting;
  const start = new Date(entry.startedAt);
  const datePart = formatDate(start);
  const startTime = formatTime(start);

  if (!entry.endedAt) {
    return {
      id: entry.id,
      shiftName: entry.shiftInstance?.master.title ?? entry.notes ?? '',
      dateTime: `${datePart}, ${startTime}`,
      hours: 0,
    };
  }

  const end = new Date(entry.endedAt);
  return {
    id: entry.id,
    shiftName: entry.shiftInstance?.master.title ?? entry.notes ?? '',
    dateTime: `${datePart}, ${startTime}–${formatTime(end)}`,
    hours: hoursBetween(entry.startedAt, entry.endedAt),
  };
}

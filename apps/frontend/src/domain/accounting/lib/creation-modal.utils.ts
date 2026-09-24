import type { EligibleTimeEntry } from '@repo/data';
import type { EligibleHourLine } from '../components/eligible-hours-card';
import { billingYearBounds } from './billing-period';

/**
 * Extracts the year from the contract's manual "Vertragslaufzeit" field
 * (a coordinator-typed "MM/YYYY" string, e.g. "01/2026") and returns the full
 * calendar-year period the backend contract row covers — contracts always run
 * a whole calendar year, never just the entered month (see
 * board-data.utils.ts's `contractPeriodOverlapsYear`). Falls back to `now`'s year
 * when the string doesn't parse, so a malformed manual entry never blocks
 * contract creation.
 */
export function contractPeriodForLifespan(
  lifespan: string,
  now: Date = new Date(),
): { periodStart: string; periodEnd: string } {
  const match = lifespan.match(/(\d{4})\s*$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  return billingYearBounds(year);
}

/** Hours between two ISO timestamps, rounded to hundredths so display never shows floating-point noise. */
/**
 * Hours as the document prints them — German decimal comma, two places at most:
 * 10, 5,58. Rounding here is what keeps a sum of already-rounded rows from
 * printing its binary-float tail (10 + 5,58 + 12,48 is 28.060000000000002 in
 * IEEE 754, and the page said so).
 */
export function formatHours(hours: number): string {
  return `${Math.round(hours * 100) / 100}`.replace('.', ',');
}

/** The selection's total hours, rounded the way each row already is. */
export function sumHours(hours: number[]): number {
  return Math.round(hours.reduce((total, one) => total + one, 0) * 100) / 100;
}

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
/**
 * The name this one occurrence goes by — its own title when a coordinator
 * renamed it, otherwise the shift it repeats from. Undefined when the hours
 * were tracked without a shift at all.
 */
function shiftInstanceName(entry: EligibleTimeEntry): string | undefined {
  const instance = entry.shiftInstance;
  if (!instance) return undefined;
  return instance.overrideTitle ?? instance.master.title;
}

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
      shiftName: shiftInstanceName(entry) ?? entry.notes ?? '',
      dateTime: `${datePart}, ${startTime}`,
      hours: 0,
    };
  }

  const end = new Date(entry.endedAt);
  return {
    id: entry.id,
    shiftName: shiftInstanceName(entry) ?? entry.notes ?? '',
    dateTime: `${datePart}, ${startTime}–${formatTime(end)}`,
    hours: hoursBetween(entry.startedAt, entry.endedAt),
  };
}

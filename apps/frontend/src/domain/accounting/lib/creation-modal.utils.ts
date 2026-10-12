import type { EligibleTimeEntry } from '@repo/data';
import { type LifespanShape, parseLifespanShape } from '@repo/lifespan';
import type { EligibleHourLine } from '../components/eligible-hours-card';
import {
  billingMonthBounds,
  billingYearBounds,
  type PeriodBounds,
  toPeriodBounds,
} from './billing-period';

/**
 * The period the contract's manual "Vertragslaufzeit" field states. The field
 * is the same "period" value the template builder produces, so it can be a
 * single month ("08/2026"), a whole year ("2026") or a day range
 * ("01.08.2026–15.08.2026"). The contract row must cover exactly what the
 * signed agreement states — a month agreement is valid for that month only
 * (VOLI-1370). The string is read by `@repo/lifespan`, the same parser the
 * backend uses for auto-queued drafts, so printed and stored periods agree.
 */
function boundsForShape(shape: LifespanShape): PeriodBounds | undefined {
  switch (shape.kind) {
    case 'range':
      return toPeriodBounds({
        from: new Date(shape.from.year, shape.from.month - 1, shape.from.day),
        to: new Date(shape.to.year, shape.to.month - 1, shape.to.day),
      });
    case 'month':
      return billingMonthBounds(shape.year, shape.month - 1);
    case 'year':
      return billingYearBounds(shape.year);
  }
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
  const shape = parseLifespanShape(lifespan);
  return shape ? boundsForShape(shape) : undefined;
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

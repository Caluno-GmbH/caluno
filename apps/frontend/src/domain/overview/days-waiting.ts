import { tz } from '@date-fns/tz';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';

const appTz = { in: tz(DEFAULT_TIMEZONE) } as const;

/** Whole calendar days since the request, in the app timezone. Today is 0. */
export function daysWaiting(
  requestedAt: string | undefined,
  now: Date = new Date(),
): number | undefined {
  if (!requestedAt) return undefined;
  const requested = parseISO(requestedAt);
  if (Number.isNaN(requested.getTime())) return undefined;
  return Math.max(0, differenceInCalendarDays(now, requested, appTz));
}

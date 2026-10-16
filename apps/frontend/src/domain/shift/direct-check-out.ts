/**
 * Rule for the check-in decide step: whether a scanned volunteer can go
 * straight to check-out. That is the case only when they have exactly one
 * open time entry and it is Today's time entry.
 *
 * Today is the Europe/Berlin calendar day. An entry with a shift instance is
 * today when today falls inside the instance's date range, inclusive at both
 * ends, and `startedAt` is ignored (an early check-in the evening before still
 * counts on the shift day). A General check-in has no instance, so it counts
 * only when `startedAt` is today.
 *
 * Kept free of React and of the generated GraphQL types so the rule is
 * unit-testable.
 */
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import { zonedDayKey } from '@/lib/formatting/relative-day';

export type DirectCheckOutEntry = {
  id: string;
  startedAt: string;
  shiftInstance?: { actualStartsAt: string; actualEndsAt: string } | null;
};

export function isTodaysTimeEntry(
  entry: DirectCheckOutEntry,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  const today = zonedDayKey(now.toISOString(), timeZone);
  if (!today) return false;

  const { shiftInstance } = entry;
  if (!shiftInstance) {
    return zonedDayKey(entry.startedAt, timeZone) === today;
  }

  const startDay = zonedDayKey(shiftInstance.actualStartsAt, timeZone);
  const endDay = zonedDayKey(shiftInstance.actualEndsAt, timeZone);
  if (!startDay || !endDay) return false;

  // Keys are YYYY-MM-DD, so string comparison is calendar order.
  return startDay <= today && today <= endDay;
}

export function resolveDirectCheckOutEntryId(
  entries: readonly DirectCheckOutEntry[],
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  if (entries.length !== 1) return null;
  const [only] = entries;
  return only && isTodaysTimeEntry(only, now, timeZone) ? only.id : null;
}

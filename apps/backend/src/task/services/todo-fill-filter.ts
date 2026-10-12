import { appDateParts, startOfAppDay } from '../../shift/utils/app-time';
import { TodoFillThreshold } from '../enums/todo-fill-threshold.enum';

export const FILL_ASSIGNMENT_DAYS = [7, 14, 30] as const;
export type FillAssignmentDays = (typeof FILL_ASSIGNMENT_DAYS)[number];
export type FillAssignmentThreshold = TodoFillThreshold;

export interface FillAssignmentFilter {
  threshold: FillAssignmentThreshold;
  daysAhead: FillAssignmentDays;
}

export const DEFAULT_FILL_ASSIGNMENT_FILTER: FillAssignmentFilter = {
  threshold: TodoFillThreshold.BELOW_MINIMUM,
  daysAhead: 14,
};

export function isFillAssignmentDays(
  value: number,
): value is FillAssignmentDays {
  return (FILL_ASSIGNMENT_DAYS as readonly number[]).includes(value);
}

export function isFillAssignmentThreshold(
  value: string,
): value is FillAssignmentThreshold {
  return (
    value === TodoFillThreshold.BELOW_MINIMUM ||
    value === TodoFillThreshold.NOT_FULL
  );
}

/**
 * True when the start instant is already in the past. An ongoing shift has
 * started, including one that runs across midnight. Comparison is on the
 * absolute instant, so the org timezone does not shift it.
 */
export function startHasPassed(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() < now.getTime();
}

/** Start of today through the end of the last included day, in the app timezone. */
export function fillAssignmentWindow(
  now: Date,
  daysAhead: number,
): { start: Date; end: Date } {
  const { year, month, day } = appDateParts(now);
  return {
    start: startOfAppDay(year, month, day),
    end: startOfAppDay(year, month, day + daysAhead + 1),
  };
}

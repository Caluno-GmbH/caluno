import type { EligibleTimesheetVolunteer } from '../accounting.types';
import { billingMonthBoundsOf } from './billing-period';

/** An eligible time entry as the timesheet grouping needs it: ended, and paid. */
export interface TimesheetCandidateEntry {
  id: string;
  volunteerId: string;
  reimbursementTypeId: string;
  startedAt: Date;
  endedAt: Date;
}

/**
 * Groups eligible entries by volunteer, reimbursement type and Berlin calendar
 * month into the rows of "timesheets still to be created", summing the hours
 * (rounded to hundredths) and noting which hours have no contract.
 *
 * An entry's id in `uncoveredIds` marks its hours as uncovered. A month is
 * uncovered when any of its entries is, and it starts at the earliest such
 * entry whatever order the entries arrive in (the query has no ORDER BY).
 */
export function groupTimesheetCandidates(
  entries: readonly TimesheetCandidateEntry[],
  uncoveredIds: ReadonlySet<string>,
): EligibleTimesheetVolunteer[] {
  const groups = new Map<string, EligibleTimesheetVolunteer>();
  for (const entry of entries) {
    const month = billingMonthBoundsOf(entry.startedAt);
    const key = `${entry.volunteerId}:${entry.reimbursementTypeId}:${month.start.toISOString()}`;
    const group = groups.get(key) ?? {
      volunteerId: entry.volunteerId,
      reimbursementTypeId: entry.reimbursementTypeId,
      periodStart: month.start,
      periodEnd: month.end,
      eligibleHours: 0,
      hasUncoveredHours: false,
      firstUncoveredAt: null,
    };
    group.eligibleHours +=
      (entry.endedAt.getTime() - entry.startedAt.getTime()) / 3_600_000;
    if (uncoveredIds.has(entry.id)) {
      group.hasUncoveredHours = true;
      if (!group.firstUncoveredAt || entry.startedAt < group.firstUncoveredAt) {
        group.firstUncoveredAt = entry.startedAt;
      }
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    eligibleHours: Math.round(group.eligibleHours * 100) / 100,
  }));
}

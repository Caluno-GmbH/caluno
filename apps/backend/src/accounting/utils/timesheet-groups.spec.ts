import { describe, expect, it } from 'bun:test';
import { startOfAppDay } from '../../shift/utils/app-time';
import {
  groupTimesheetCandidates,
  type TimesheetCandidateEntry,
} from './timesheet-groups';

const VOLUNTEER = 'volunteer-1';
const TYPE = 'type-1';

let sequence = 0;
function entry(
  startedAt: Date,
  hours: number,
  overrides: Partial<TimesheetCandidateEntry> = {},
): TimesheetCandidateEntry {
  sequence += 1;
  return {
    id: `entry-${sequence}`,
    volunteerId: VOLUNTEER,
    reimbursementTypeId: TYPE,
    startedAt,
    endedAt: new Date(startedAt.getTime() + hours * 3_600_000),
    ...overrides,
  };
}

/** Noon Berlin wall time on a July 2026 day. */
const july = (day: number) =>
  new Date(startOfAppDay(2026, 6, day).getTime() + 12 * 3_600_000);

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      (rest) => [item, ...rest],
    ),
  );
}

describe('groupTimesheetCandidates', () => {
  it('sums the hours per volunteer, type and Berlin month and rounds to hundredths', () => {
    const rows = groupTimesheetCandidates(
      [
        entry(july(3), 1.333),
        entry(july(20), 2.001),
        // 23:30 Berlin on 31 July is still July.
        entry(new Date(startOfAppDay(2026, 7, 1).getTime() - 30 * 60_000), 0.5),
        entry(startOfAppDay(2026, 7, 3), 1),
      ],
      new Set(),
      new Set(),
    ).sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

    expect(rows.map((row) => row.eligibleHours)).toEqual([3.83, 1]);
    expect(rows[0]?.periodStart).toEqual(startOfAppDay(2026, 6, 1));
    expect(rows[0]?.periodEnd).toEqual(startOfAppDay(2026, 7, 1));
  });

  it('keeps volunteers and reimbursement types apart', () => {
    const rows = groupTimesheetCandidates(
      [
        entry(july(3), 1),
        entry(july(4), 1, { volunteerId: 'volunteer-2' }),
        entry(july(5), 1, { reimbursementTypeId: 'type-2' }),
      ],
      new Set(),
      new Set(),
    );

    expect(rows).toHaveLength(3);
  });

  it('is covered with no start when no entry of the month is uncovered', () => {
    const [row] = groupTimesheetCandidates(
      [entry(july(3), 1), entry(july(9), 1)],
      new Set(),
      new Set(),
    );

    expect(row?.hasUncoveredHours).toBe(false);
    expect(row?.firstUncoveredAt).toBeNull();
  });

  it('starts at the earliest uncovered entry whatever order the entries arrive in', () => {
    const covered = entry(july(1), 1);
    const early = entry(july(16), 1);
    const middle = entry(july(20), 1);
    const late = entry(july(25), 1);
    const uncovered = new Set([early.id, middle.id, late.id]);

    for (const order of permutations([covered, early, middle, late])) {
      const [row] = groupTimesheetCandidates(order, uncovered, new Set());
      expect(row?.hasUncoveredHours).toBe(true);
      expect(row?.firstUncoveredAt).toEqual(early.startedAt);
    }
  });

  it('answers each month on its own', () => {
    const coveredJuly = entry(july(3), 1);
    const uncoveredAugust = entry(startOfAppDay(2026, 7, 12), 1);

    const rows = groupTimesheetCandidates(
      [coveredJuly, uncoveredAugust],
      new Set([uncoveredAugust.id]),
      new Set(),
    ).sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

    expect(rows.map((row) => row.hasUncoveredHours)).toEqual([false, true]);
    expect(rows[1]?.firstUncoveredAt).toEqual(uncoveredAugust.startedAt);
  });

  it('flags a month that has an entry without an ACTIVE contract, independently of open cover', () => {
    const withActive = entry(july(3), 1);
    const withoutActive = entry(july(9), 1);

    const [row] = groupTimesheetCandidates(
      [withActive, withoutActive],
      new Set(), // everything is openly covered (for example by a draft)
      new Set([withoutActive.id]),
    );

    expect(row?.hasUncoveredHours).toBe(false);
    expect(row?.hasHoursWithoutActiveContract).toBe(true);
  });

  it('is false for a month whose every entry has an ACTIVE contract', () => {
    const [row] = groupTimesheetCandidates(
      [entry(july(3), 1), entry(july(9), 1)],
      new Set(),
      new Set(),
    );

    expect(row?.hasHoursWithoutActiveContract).toBe(false);
  });
});

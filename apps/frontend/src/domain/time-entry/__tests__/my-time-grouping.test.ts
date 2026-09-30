import { describe, expect, it } from 'bun:test';
import { formats } from '@/lib/formatting/formats';
import {
  entryDurationMinutes,
  getEntryState,
  groupMyTime,
  type TimeEntry,
  WEEK_HEADER_FROM_FORMAT,
  WEEK_HEADER_TO_FORMAT,
} from '../my-time-grouping';

const entry = (
  over: Partial<TimeEntry> & { startedAt: string },
): TimeEntry => ({
  id: 'x',
  endedAt: null,
  shiftInstance: {
    id: 'shift-instance-x',
    overrideTitle: null,
    master: {
      id: 'shift-x',
      title: 'Shift',
      organizationUnit: {
        id: 'unit-x',
        name: 'Unit',
        organization: {
          id: 'org-x',
          name: 'Org',
        },
      },
    },
  },
  organizationUnit: {
    id: 'unit-x',
    name: 'Unit',
    organization: {
      id: 'org-x',
      name: 'Org',
    },
  },
  ...over,
});

describe('getEntryState', () => {
  it('is in-progress when endedAt is null', () => {
    expect(
      getEntryState(
        entry({ startedAt: '2026-06-10T09:00:00Z', endedAt: null }),
      ),
    ).toBe('in-progress');
  });
  it('is completed when endedAt is set', () => {
    expect(
      getEntryState(
        entry({
          startedAt: '2026-06-10T09:00:00Z',
          endedAt: '2026-06-10T13:00:00Z',
        }),
      ),
    ).toBe('completed');
  });
});

describe('entryDurationMinutes', () => {
  it('returns 0 for in-progress entries', () => {
    expect(
      entryDurationMinutes(
        entry({ startedAt: '2026-06-10T09:00:00Z', endedAt: null }),
      ),
    ).toBe(0);
  });
  it('returns elapsed minutes for completed entries', () => {
    expect(
      entryDurationMinutes(
        entry({
          startedAt: '2026-06-10T09:00:00Z',
          endedAt: '2026-06-10T13:30:00Z',
        }),
      ),
    ).toBe(270);
  });
});

describe('groupMyTime', () => {
  it('groups entries by Monday-start week, newest week first', () => {
    // Wed Jun 10 and Fri Jun 12 2026 are in the same week (Mon Jun 8–Sun Jun 14)
    const result = groupMyTime([
      entry({
        id: 'b',
        startedAt: '2026-06-12T09:00:00Z',
        endedAt: '2026-06-12T11:00:00Z',
      }),
      entry({
        id: 'a',
        startedAt: '2026-06-10T09:00:00Z',
        endedAt: '2026-06-10T13:00:00Z',
      }),
    ]);
    expect(result.weeks).toHaveLength(1);
    const [week] = result.weeks;
    if (!week) throw new Error('expected a week');
    expect(week.entries.map((e) => e.id)).toEqual(['b', 'a']); // newest first within week
  });

  it('sums weekly totals from completed entries only', () => {
    const result = groupMyTime([
      entry({
        startedAt: '2026-06-10T09:00:00Z',
        endedAt: '2026-06-10T13:00:00Z',
      }), // 240
      entry({ startedAt: '2026-06-11T09:00:00Z', endedAt: null }), // in-progress: 0
    ]);
    const [week] = result.weeks;
    if (!week) throw new Error('expected a week');
    expect(week.totalMinutes).toBe(240);
    expect(result.allTimeMinutes).toBe(240);
  });

  it('returns no weeks for an empty list', () => {
    expect(groupMyTime([])).toEqual({ allTimeMinutes: 0, weeks: [] });
  });

  it('orders separate weeks newest-first', () => {
    const result = groupMyTime([
      entry({
        startedAt: '2026-06-10T09:00:00Z',
        endedAt: '2026-06-10T10:00:00Z',
      }),
      entry({
        startedAt: '2026-06-01T09:00:00Z',
        endedAt: '2026-06-01T10:00:00Z',
      }),
    ]);
    expect(result.weeks).toHaveLength(2);
    const [newer, older] = result.weeks;
    if (!newer || !older) throw new Error('expected two weeks');
    expect(newer.weekStart.getTime()).toBeGreaterThan(
      older.weekStart.getTime(),
    );
  });
});

describe('week header label', () => {
  it('shows the calendar dates of the week containing the entry', () => {
    const { weeks } = groupMyTime([
      entry({
        startedAt: '2026-09-15T12:18:00Z',
        endedAt: '2026-09-15T12:21:00Z',
      }),
    ]);
    const [week] = weeks;
    if (!week) throw new Error('expected a week');
    expect(
      formats('en').formatRange(
        week.weekStart,
        week.weekEnd,
        '',
        WEEK_HEADER_FROM_FORMAT,
        WEEK_HEADER_TO_FORMAT,
      ),
    ).toBe('14 Sep - 20 Sep 2026');
  });
});

describe('minute truncation', () => {
  it('truncates seconds so group totals match the displayed entry durations', () => {
    const { weeks, allTimeMinutes } = groupMyTime([
      entry({
        startedAt: '2026-09-15T12:18:40Z',
        endedAt: '2026-09-15T12:22:10Z',
      }),
    ]);
    expect(weeks[0]?.totalMinutes).toBe(3);
    expect(allTimeMinutes).toBe(3);
  });
});

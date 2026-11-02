import { describe, expect, it, mock } from 'bun:test';
import { TimeEntryStatus } from '@repo/data';
import { buildTimesheetsActiveFilters } from './timesheets-active-filters';

const noop = () => {};
const labels = {
  status: 'Status',
  shift: 'Shift',
  volunteer: 'Volunteer',
  date: 'Date',
  location: 'Location',
};
const statusLabels = {
  [TimeEntryStatus.Open]: 'Checked in',
  [TimeEntryStatus.Closed]: 'Checked out',
  [TimeEntryStatus.AutoClosed]: 'Auto checked out',
};

const emptyValues = {
  statuses: [] as TimeEntryStatus[],
  shiftId: null,
  volunteerId: null,
  dateFrom: null,
  dateTo: null,
  location: null,
};

describe('buildTimesheetsActiveFilters', () => {
  it('returns empty array when no filters active', () => {
    const result = buildTimesheetsActiveFilters({
      values: emptyValues,
      labels,
      statusLabels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(0);
  });

  it('returns a chip for active location filter', () => {
    const result = buildTimesheetsActiveFilters({
      values: { ...emptyValues, location: 'Hall A' },
      labels,
      statusLabels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('location');
    expect(result[0]?.display).toBe('Hall A');
  });

  it('returns a chip for shift filter with label', () => {
    const result = buildTimesheetsActiveFilters({
      values: { ...emptyValues, shiftId: 'shift-1' },
      labels,
      statusLabels,
      shiftLabel: 'Morning Shift',
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('shift');
    expect(result[0]?.display).toBe('Morning Shift');
  });

  it('returns a chip for volunteer filter with label', () => {
    const result = buildTimesheetsActiveFilters({
      values: { ...emptyValues, volunteerId: 'vol-1' },
      labels,
      statusLabels,
      shiftLabel: null,
      volunteerLabel: 'Alice',
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('volunteer');
    expect(result[0]?.display).toBe('Alice');
  });

  it('returns a date chip when dateFrom is set', () => {
    const result = buildTimesheetsActiveFilters({
      values: { ...emptyValues, dateFrom: new Date('2024-01-01') },
      labels,
      statusLabels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: (from, to) =>
        `${from?.toISOString() ?? ''} – ${to?.toISOString() ?? ''}`,
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('date');
  });

  it('returns a chip per selected status', () => {
    const onClear = mock(() => {});
    const result = buildTimesheetsActiveFilters({
      values: {
        ...emptyValues,
        statuses: [TimeEntryStatus.Open, TimeEntryStatus.Closed],
      },
      labels,
      statusLabels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear,
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe(`status:${TimeEntryStatus.Open}`);
    expect(result[0]?.display).toBe('Checked in');
    expect(result[1]?.key).toBe(`status:${TimeEntryStatus.Closed}`);
    expect(result[1]?.display).toBe('Checked out');

    result[0]?.onClear();
    expect(onClear).toHaveBeenCalledWith('status', TimeEntryStatus.Open);
  });

  it('returns a chip per active filter', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [TimeEntryStatus.Open],
        shiftId: 's1',
        volunteerId: 'v1',
        dateFrom: null,
        dateTo: null,
        location: 'Hall A',
      },
      labels,
      statusLabels,
      shiftLabel: 'Shift A',
      volunteerLabel: 'Alice',
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(4);
  });
});

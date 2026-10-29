import { describe, expect, it } from 'bun:test';
import { buildTimesheetsActiveFilters } from './timesheets-active-filters';

const noop = () => {};
const labels = {
  status: 'Status',
  shift: 'Shift',
  volunteer: 'Volunteer',
  date: 'Date',
  location: 'Location',
};

describe('buildTimesheetsActiveFilters', () => {
  it('returns empty array when no filters active', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: null,
        volunteerId: null,
        dateFrom: null,
        dateTo: null,
        location: null,
      },
      labels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(0);
  });

  it('returns a chip for active location filter', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: null,
        volunteerId: null,
        dateFrom: null,
        dateTo: null,
        location: 'Hall A',
      },
      labels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('location');
    expect(result[0]!.display).toBe('Hall A');
  });

  it('returns a chip for shift filter with label', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: 'shift-1',
        volunteerId: null,
        dateFrom: null,
        dateTo: null,
        location: null,
      },
      labels,
      shiftLabel: 'Morning Shift',
      volunteerLabel: null,
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('shift');
    expect(result[0]!.display).toBe('Morning Shift');
  });

  it('returns a chip for volunteer filter with label', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: null,
        volunteerId: 'vol-1',
        dateFrom: null,
        dateTo: null,
        location: null,
      },
      labels,
      shiftLabel: null,
      volunteerLabel: 'Alice',
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('volunteer');
    expect(result[0]!.display).toBe('Alice');
  });

  it('returns a date chip when dateFrom is set', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: null,
        volunteerId: null,
        dateFrom: new Date('2024-01-01'),
        dateTo: null,
        location: null,
      },
      labels,
      shiftLabel: null,
      volunteerLabel: null,
      formatDateRange: (from, to) => `${from?.toISOString() ?? ''} – ${to?.toISOString() ?? ''}`,
      onClear: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe('date');
  });

  it('returns a chip per active filter', () => {
    const result = buildTimesheetsActiveFilters({
      values: {
        statuses: [],
        shiftId: 's1',
        volunteerId: 'v1',
        dateFrom: null,
        dateTo: null,
        location: 'Hall A',
      },
      labels,
      shiftLabel: 'Shift A',
      volunteerLabel: 'Alice',
      formatDateRange: () => '',
      onClear: noop,
    });
    expect(result).toHaveLength(3);
  });
});

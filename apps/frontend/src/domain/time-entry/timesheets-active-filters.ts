import type { TimeEntryStatus } from '@repo/data';
import type { TableToolbarActiveFilter } from '@repo/ui';

export type TimesheetFilterField =
  | 'status'
  | 'shift'
  | 'volunteer'
  | 'date'
  | 'location';

export interface TimesheetFilterValues {
  statuses: TimeEntryStatus[];
  shiftId: string | null;
  volunteerId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  location: string | null;
}

export function buildTimesheetsActiveFilters(args: {
  values: TimesheetFilterValues;
  labels: Record<TimesheetFilterField, string>;
  shiftLabel: string | null;
  volunteerLabel: string | null;
  formatDateRange: (from: Date | null, to: Date | null) => string;
  onClear: (field: TimesheetFilterField) => void;
}): TableToolbarActiveFilter[] {
  const {
    values,
    labels,
    shiftLabel,
    volunteerLabel,
    formatDateRange,
    onClear,
  } = args;
  const filters: TableToolbarActiveFilter[] = [];

  if (values.shiftId && shiftLabel) {
    filters.push({
      key: 'shift',
      label: labels.shift,
      display: shiftLabel,
      onClear: () => onClear('shift'),
    });
  }

  if (values.volunteerId && volunteerLabel) {
    filters.push({
      key: 'volunteer',
      label: labels.volunteer,
      display: volunteerLabel,
      onClear: () => onClear('volunteer'),
    });
  }

  if (values.dateFrom || values.dateTo) {
    filters.push({
      key: 'date',
      label: labels.date,
      display: formatDateRange(values.dateFrom, values.dateTo),
      onClear: () => onClear('date'),
    });
  }

  if (values.location) {
    filters.push({
      key: 'location',
      label: labels.location,
      display: values.location,
      onClear: () => onClear('location'),
    });
  }

  return filters;
}

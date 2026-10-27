import type { ShiftVisibility } from '@repo/data';
import type { TableToolbarActiveFilter } from '@repo/ui';

export type ShiftFilterField =
  | 'q'
  | 'location'
  | 'visibility'
  | 'date'
  | 'fill';

export interface ShiftFilterValues {
  q: string;
  location: string;
  visibility: ShiftVisibility | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  fill: '' | 'below' | 'ok' | 'full';
}

export function buildShiftActiveFilters(args: {
  values: ShiftFilterValues;
  labels: Record<ShiftFilterField, string>;
  formatDateRange: (from: Date | null, to: Date | null) => string;
  displayVisibility: (v: ShiftVisibility) => string;
  displayFill: (f: 'below' | 'ok' | 'full') => string;
  onClear: (field: ShiftFilterField) => void;
}): TableToolbarActiveFilter[] {
  const {
    values,
    labels,
    formatDateRange,
    displayVisibility,
    displayFill,
    onClear,
  } = args;
  const filters: TableToolbarActiveFilter[] = [];

  if (values.q.trim()) {
    filters.push({
      key: 'q',
      label: labels.q,
      display: values.q,
      onClear: () => onClear('q'),
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

  if (values.visibility !== null) {
    filters.push({
      key: 'visibility',
      label: labels.visibility,
      display: displayVisibility(values.visibility),
      onClear: () => onClear('visibility'),
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

  if (values.fill) {
    filters.push({
      key: 'fill',
      label: labels.fill,
      display: displayFill(values.fill),
      onClear: () => onClear('fill'),
    });
  }

  return filters;
}

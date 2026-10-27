import { describe, expect, it } from 'bun:test';
import { ShiftVisibility } from '@repo/data';
import type {
  ShiftFilterField,
  ShiftFilterValues,
} from './shift-active-filters';
import { buildShiftActiveFilters } from './shift-active-filters';

const defaultValues: ShiftFilterValues = {
  q: '',
  location: '',
  visibility: null,
  dateFrom: null,
  dateTo: null,
  fill: '',
};

const labels: Record<ShiftFilterField, string> = {
  q: 'Search',
  location: 'Location',
  visibility: 'Visibility',
  date: 'Date range',
  fill: 'Staffing',
};

const formatDateRange = (from: Date | null, to: Date | null) =>
  `${from?.toISOString() ?? '?'} – ${to?.toISOString() ?? '?'}`;

const displayVisibility = (v: ShiftVisibility) =>
  v === ShiftVisibility.AllMembers ? 'All members' : 'Invited';

const displayFill = (f: 'below' | 'ok' | 'full') =>
  ({ below: 'Below min', ok: 'OK', full: 'Full' })[f];

describe('buildShiftActiveFilters', () => {
  it('returns [] when all values are default', () => {
    const result = buildShiftActiveFilters({
      values: defaultValues,
      labels,
      formatDateRange,
      displayVisibility,
      displayFill,
      onClear: () => {},
    });
    expect(result).toEqual([]);
  });

  it('returns one descriptor per active filter', () => {
    const dateFrom = new Date('2026-01-01T00:00:00.000Z');
    const dateTo = new Date('2026-01-31T00:00:00.000Z');
    const result = buildShiftActiveFilters({
      values: {
        q: 'hello',
        location: 'Main Hall',
        visibility: ShiftVisibility.AllMembers,
        dateFrom,
        dateTo,
        fill: 'below',
      },
      labels,
      formatDateRange,
      displayVisibility,
      displayFill,
      onClear: () => {},
    });

    expect(result).toHaveLength(5);
    expect(result.map((f) => f.key)).toEqual([
      'q',
      'location',
      'visibility',
      'date',
      'fill',
    ]);
  });

  it('uses correct display values for each filter', () => {
    const dateFrom = new Date('2026-06-01T00:00:00.000Z');
    const result = buildShiftActiveFilters({
      values: {
        ...defaultValues,
        q: 'test query',
        location: 'Gym',
        visibility: ShiftVisibility.InvitedMembers,
        dateFrom,
        fill: 'full',
      },
      labels,
      formatDateRange,
      displayVisibility,
      displayFill,
      onClear: () => {},
    });

    const byKey = Object.fromEntries(result.map((f) => [f.key, f]));
    // biome-ignore lint/style/noNonNullAssertion: test-only assertion
    expect(byKey.q!.display).toBe('test query');
    // biome-ignore lint/style/noNonNullAssertion: test-only assertion
    expect(byKey.location!.display).toBe('Gym');
    // biome-ignore lint/style/noNonNullAssertion: test-only assertion
    expect(byKey.visibility!.display).toBe('Invited');
    // biome-ignore lint/style/noNonNullAssertion: test-only assertion
    expect(byKey.date!.display).toBe(formatDateRange(dateFrom, null));
    // biome-ignore lint/style/noNonNullAssertion: test-only assertion
    expect(byKey.fill!.display).toBe('Full');
  });

  it('calls onClear with the correct field', () => {
    const cleared: ShiftFilterField[] = [];
    const result = buildShiftActiveFilters({
      values: {
        ...defaultValues,
        q: 'foo',
        location: 'Bar',
        visibility: ShiftVisibility.AllMembers,
      },
      labels,
      formatDateRange,
      displayVisibility,
      displayFill,
      onClear: (field) => cleared.push(field),
    });

    for (const filter of result) {
      filter.onClear();
    }

    expect(cleared).toEqual(['q', 'location', 'visibility']);
  });

  it('ignores whitespace-only q', () => {
    const result = buildShiftActiveFilters({
      values: { ...defaultValues, q: '   ' },
      labels,
      formatDateRange,
      displayVisibility,
      displayFill,
      onClear: () => {},
    });
    expect(result).toEqual([]);
  });
});

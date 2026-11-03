import { describe, expect, it } from 'bun:test';
import {
  ACTIONS_UNSTACK_HYSTERESIS_PX,
  clampActions,
  formatResultsLabel,
  hasActiveFilters,
  nextActionsStackState,
} from './table-toolbar.utils';

describe('clampActions', () => {
  it('returns an empty array when actions is undefined', () => {
    expect(clampActions(undefined)).toEqual([]);
  });

  it('returns the actions unchanged when two or fewer', () => {
    expect(clampActions(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('keeps only the first two actions when more are passed', () => {
    expect(clampActions(['a', 'b', 'c'])).toEqual(['a', 'b']);
  });
});

describe('formatResultsLabel', () => {
  it('falls back when the count is undefined', () => {
    expect(formatResultsLabel(undefined)).toBe('Show results');
  });

  it('uses the singular for one result', () => {
    expect(formatResultsLabel(1)).toBe('Show 1 result');
  });

  it('uses the plural for zero and many', () => {
    expect(formatResultsLabel(0)).toBe('Show 0 results');
    expect(formatResultsLabel(42)).toBe('Show 42 results');
  });
});

describe('hasActiveFilters', () => {
  it('is false for undefined', () => {
    expect(hasActiveFilters(undefined)).toBe(false);
  });

  it('is false for an empty array', () => {
    expect(hasActiveFilters([])).toBe(false);
  });

  it('is true when at least one filter is present', () => {
    expect(
      hasActiveFilters([
        { key: 'loc', label: 'Location', display: 'Hall A', onClear: () => {} },
      ]),
    ).toBe(true);
  });
});

describe('nextActionsStackState', () => {
  it('stays side-by-side while filters fit in two rows', () => {
    expect(
      nextActionsStackState({
        stacked: false,
        filterRows: 2,
        toolbarWidth: 900,
        stackedAtWidth: null,
      }),
    ).toEqual({ stacked: false, stackedAtWidth: null });
  });

  it('stacks when filters spill into a third row', () => {
    expect(
      nextActionsStackState({
        stacked: false,
        filterRows: 3,
        toolbarWidth: 800,
        stackedAtWidth: null,
      }),
    ).toEqual({ stacked: true, stackedAtWidth: 800 });
  });

  it('stays stacked until width clears the hysteresis band', () => {
    expect(
      nextActionsStackState({
        stacked: true,
        filterRows: 2,
        toolbarWidth: 820,
        stackedAtWidth: 800,
      }),
    ).toEqual({ stacked: true, stackedAtWidth: 800 });

    expect(
      nextActionsStackState({
        stacked: true,
        filterRows: 2,
        toolbarWidth: 800 + ACTIONS_UNSTACK_HYSTERESIS_PX + 1,
        stackedAtWidth: 800,
      }),
    ).toEqual({ stacked: false, stackedAtWidth: null });
  });

  it('tries side-by-side when stacked without a recorded threshold and filters fit', () => {
    expect(
      nextActionsStackState({
        stacked: true,
        filterRows: 2,
        toolbarWidth: 1000,
        stackedAtWidth: null,
      }),
    ).toEqual({ stacked: false, stackedAtWidth: null });
  });
});

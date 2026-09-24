import { describe, expect, it } from 'bun:test';
import {
  headerCheckedState,
  joinEmails,
  toggleVisible,
} from './volunteer-selection';

describe('headerCheckedState', () => {
  it('returns false when none of the visible ids are selected', () => {
    expect(headerCheckedState(['a', 'b'], new Set())).toBe(false);
  });

  it('returns indeterminate when some visible ids are selected', () => {
    expect(headerCheckedState(['a', 'b'], new Set(['a']))).toBe(
      'indeterminate',
    );
  });

  it('returns true when all visible ids are selected', () => {
    expect(headerCheckedState(['a', 'b'], new Set(['a', 'b']))).toBe(true);
  });

  it('returns false for an empty visible list', () => {
    expect(headerCheckedState([], new Set(['a']))).toBe(false);
  });

  it('ignores selected ids that are not visible', () => {
    expect(headerCheckedState(['a'], new Set(['a', 'off-1', 'off-2']))).toBe(
      true,
    );
  });
});

describe('toggleVisible', () => {
  it('selects all visible when none are selected', () => {
    const result = toggleVisible(['a', 'b'], new Set());
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('selects all visible when only some are selected', () => {
    const result = toggleVisible(['a', 'b'], new Set(['a']));
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('deselects the visible ones when all visible are selected, leaving off-screen selections intact', () => {
    const result = toggleVisible(['a', 'b'], new Set(['a', 'b', 'off-1']));
    expect(result).toEqual(new Set(['off-1']));
  });
});

describe('joinEmails', () => {
  it('joins with a comma and a space', () => {
    expect(joinEmails(['a@example.org', 'b@example.org'])).toBe(
      'a@example.org, b@example.org',
    );
  });

  it('returns an empty string for an empty array', () => {
    expect(joinEmails([])).toBe('');
  });
});

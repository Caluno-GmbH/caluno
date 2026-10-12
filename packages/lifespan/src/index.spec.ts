import { describe, expect, it } from 'bun:test';
import { parseLifespanShape } from './index';

describe('parseLifespanShape', () => {
  it('reads a year', () => {
    expect(parseLifespanShape('2026')).toEqual({ kind: 'year', year: 2026 });
  });

  it('reads a month as the picker prints it, MM/YYYY', () => {
    expect(parseLifespanShape('08/2026')).toEqual({
      kind: 'month',
      year: 2026,
      month: 8,
    });
  });

  it('reads a day range with an en dash', () => {
    expect(parseLifespanShape('01.08.2026–15.08.2026')).toEqual({
      kind: 'range',
      from: { year: 2026, month: 8, day: 1 },
      to: { year: 2026, month: 8, day: 15 },
    });
  });

  it('reads a range with a hyphen and spaces around the dash', () => {
    expect(parseLifespanShape('01.08.2026 - 15.08.2026')).toEqual({
      kind: 'range',
      from: { year: 2026, month: 8, day: 1 },
      to: { year: 2026, month: 8, day: 15 },
    });
  });

  it('accepts a one-day range', () => {
    expect(parseLifespanShape('05.10.2026–05.10.2026')?.kind).toBe('range');
  });

  it('ignores surrounding whitespace', () => {
    expect(parseLifespanShape('  2026 ')).toEqual({ kind: 'year', year: 2026 });
  });

  it('returns undefined for empty and unreadable values', () => {
    for (const value of ['', '   ', 'not-a-date', '2026-08', '08.2026', '26']) {
      expect(parseLifespanShape(value)).toBeUndefined();
    }
  });

  it('rejects a month outside 1 to 12', () => {
    expect(parseLifespanShape('00/2026')).toBeUndefined();
    expect(parseLifespanShape('13/2026')).toBeUndefined();
  });

  it('rejects days that do not exist', () => {
    expect(parseLifespanShape('31.02.2026–05.03.2026')).toBeUndefined();
    expect(parseLifespanShape('29.02.2026–01.03.2026')).toBeUndefined();
    expect(parseLifespanShape('00.01.2026–05.01.2026')).toBeUndefined();
    expect(parseLifespanShape('01.13.2026–05.01.2027')).toBeUndefined();
  });

  it('accepts 29 February in a leap year', () => {
    expect(parseLifespanShape('29.02.2028–01.03.2028')?.kind).toBe('range');
  });

  it('rejects a range that ends before it starts', () => {
    expect(parseLifespanShape('15.08.2026–01.08.2026')).toBeUndefined();
  });
});

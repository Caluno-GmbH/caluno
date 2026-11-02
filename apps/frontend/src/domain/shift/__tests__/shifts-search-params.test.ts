import { describe, expect, it } from 'bun:test';
import { parseAsLocalDate } from '../shifts-search-params';

describe('parseAsLocalDate', () => {
  it('serialises a picked local midnight as the same calendar day', () => {
    // The date picker emits local midnight; east of UTC this is the previous
    // day in UTC, which `toISOString()` would leak into the URL.
    expect(parseAsLocalDate.serialize(new Date(2026, 9, 29))).toBe(
      '2026-10-29',
    );
  });

  it('round-trips a URL date to the same calendar day', () => {
    const parsed = parseAsLocalDate.parse('2026-10-29');
    expect(parsed).toEqual(new Date(2026, 9, 29));
    expect(parsed && parseAsLocalDate.serialize(parsed)).toBe('2026-10-29');
  });

  it('accepts a full ISO timestamp by its date part', () => {
    expect(parseAsLocalDate.parse('2026-10-29T00:00:00.000Z')).toEqual(
      new Date(2026, 9, 29),
    );
  });

  it('rejects garbage', () => {
    expect(parseAsLocalDate.parse('not-a-date')).toBeNull();
  });
});

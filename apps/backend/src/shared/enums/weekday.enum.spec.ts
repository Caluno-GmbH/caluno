import { describe, expect, it } from 'bun:test';
import { appWeekday } from '../../shift/utils/app-time';
import {
  ALL_WEEKDAYS,
  sortWeekdays,
  Weekday,
  weekdayFromIsoDay,
} from './weekday.enum';

describe('weekdayFromIsoDay', () => {
  it('maps ISO 1-7 onto Monday through Sunday', () => {
    expect(weekdayFromIsoDay(1)).toBe(Weekday.MONDAY);
    expect(weekdayFromIsoDay(7)).toBe(Weekday.SUNDAY);
  });

  it('rejects days outside 1-7', () => {
    expect(() => weekdayFromIsoDay(0)).toThrow();
    expect(() => weekdayFromIsoDay(8)).toThrow();
  });
});

describe('sortWeekdays', () => {
  it('orders days Monday-first and drops duplicates', () => {
    expect(
      sortWeekdays([Weekday.SUNDAY, Weekday.MONDAY, Weekday.SUNDAY]),
    ).toEqual([Weekday.MONDAY, Weekday.SUNDAY]);
  });

  it('keeps the full week in order', () => {
    expect(sortWeekdays([...ALL_WEEKDAYS].reverse())).toEqual([
      ...ALL_WEEKDAYS,
    ]);
  });
});

describe('appWeekday', () => {
  it('uses the Berlin calendar day, not the UTC one', () => {
    expect(appWeekday(new Date('2026-09-26T12:00:00Z'))).toBe(Weekday.SATURDAY);
    expect(appWeekday(new Date('2026-09-26T22:30:00Z'))).toBe(Weekday.SUNDAY);
  });

  it('handles the winter offset', () => {
    expect(appWeekday(new Date('2026-01-01T12:00:00Z'))).toBe(Weekday.THURSDAY);
    expect(appWeekday(new Date('2026-01-01T23:30:00Z'))).toBe(Weekday.FRIDAY);
  });

  it('handles the spring DST transition', () => {
    expect(appWeekday(new Date('2026-03-29T00:30:00Z'))).toBe(Weekday.SUNDAY);
  });
});

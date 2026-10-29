import { describe, expect, it } from 'bun:test';
import {
  getAdjacentWeekParam,
  getDayInstances,
  getWeekNumber,
  getWeekRange,
  toWeekParam,
} from './shift-instances';

describe('getDayInstances', () => {
  it('places an overnight instance on the start day only', () => {
    const start = new Date('2026-09-11T18:00:00.000Z'); // Friday 20:00 Berlin
    const end = new Date('2026-09-11T23:00:00.000Z'); // Saturday 01:00 Berlin
    const instance = {
      id: 'overnight',
      actualStartsAt: start.toISOString(),
      actualEndsAt: end.toISOString(),
    };

    const friday = new Date('2026-09-11T10:00:00.000Z');
    const saturday = new Date('2026-09-12T10:00:00.000Z');

    expect(getDayInstances(friday, [instance]).map((i) => i.id)).toEqual([
      'overnight',
    ]);
    expect(getDayInstances(saturday, [instance])).toEqual([]);
  });
});

describe('getWeekRange', () => {
  it('keeps a Sunday-night start in the week that contains Sunday', () => {
    const sundayNight = new Date('2026-09-13T18:00:00.000Z'); // Sunday 20:00 Berlin
    const { weekStart, weekEnd } = getWeekRange(sundayNight);
    expect(sundayNight.getTime()).toBeGreaterThanOrEqual(weekStart.getTime());
    expect(sundayNight.getTime()).toBeLessThan(weekEnd.getTime());
    const mondayMorning = new Date('2026-09-13T23:00:00.000Z'); // Monday 01:00 Berlin
    expect(mondayMorning.getTime()).toBeGreaterThanOrEqual(weekEnd.getTime());
  });
});

describe('toWeekParam', () => {
  it('formats the Monday of a Sunday-evening reference in the app timezone', () => {
    expect(toWeekParam(new Date('2026-09-13T18:00:00.000Z'))).toBe(
      '2026-09-07',
    );
  });

  it('rolls over to the next Monday once it is Monday in Berlin', () => {
    expect(toWeekParam(new Date('2026-09-13T23:00:00.000Z'))).toBe(
      '2026-09-14',
    );
  });

  it('round-trips from a week start', () => {
    const { weekStart } = getWeekRange(new Date('2026-09-10T12:00:00.000Z'));
    expect(toWeekParam(weekStart)).toBe('2026-09-07');
  });
});

// Week starts arrive from the server as plain Dates at Monday 00:00 Berlin,
// i.e. Sunday evening in UTC — the browser timezone must not shift them.
describe('getAdjacentWeekParam', () => {
  const weekStart = new Date('2026-09-06T22:00:00.000Z'); // Monday 2026-09-07 00:00 Berlin

  it('moves exactly one Berlin week forward and back', () => {
    expect(getAdjacentWeekParam(weekStart, 'next')).toBe('2026-09-14');
    expect(getAdjacentWeekParam(weekStart, 'prev')).toBe('2026-08-31');
  });

  it('crosses the autumn DST change', () => {
    const lastSummerWeek = new Date('2026-10-18T22:00:00.000Z'); // Monday 2026-10-19 00:00 CEST
    expect(getAdjacentWeekParam(lastSummerWeek, 'next')).toBe('2026-10-26');
    const firstWinterWeek = new Date('2026-10-25T23:00:00.000Z'); // Monday 2026-10-26 00:00 CET
    expect(getAdjacentWeekParam(firstWinterWeek, 'prev')).toBe('2026-10-19');
  });
});

describe('getWeekNumber', () => {
  it('returns the ISO week of the Berlin Monday', () => {
    expect(getWeekNumber(new Date('2026-09-06T22:00:00.000Z'))).toBe(37);
  });
});

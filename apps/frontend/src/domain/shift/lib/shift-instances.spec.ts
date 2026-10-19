import { describe, expect, it } from 'bun:test';
import { getDayInstances, getWeekRange, toWeekParam } from './shift-instances';

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

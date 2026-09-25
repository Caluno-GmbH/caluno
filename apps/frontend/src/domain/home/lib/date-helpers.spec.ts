import { describe, expect, it } from 'bun:test';
import { addDays, getDayStripDaysFromCounts, startOfDay } from './date-helpers';

const today = () => startOfDay(new Date());

describe('getDayStripDaysFromCounts', () => {
  it('maps each count onto its matching day, filling gaps with zero', () => {
    const base = today();
    const counts = [
      { date: addDays(base, 0).toISOString(), count: 3 },
      { date: addDays(base, 2).toISOString(), count: 5 },
    ];

    const days = getDayStripDaysFromCounts(counts, { minDays: 3 });

    expect(days.map((d) => d.shiftCount)).toEqual([3, 0, 5]);
  });

  it('is unaffected by the order counts are given in', () => {
    const base = today();
    const counts = [
      { date: addDays(base, 2).toISOString(), count: 5 },
      { date: addDays(base, 0).toISOString(), count: 3 },
    ];

    const days = getDayStripDaysFromCounts(counts, { minDays: 3 });

    expect(days.map((d) => d.shiftCount)).toEqual([3, 0, 5]);
  });

  it('extends the window to at least minDays even when counts end earlier', () => {
    const base = today();
    const counts = [{ date: base.toISOString(), count: 1 }];

    const days = getDayStripDaysFromCounts(counts, { minDays: 7 });

    expect(days).toHaveLength(7);
    expect(days[0]?.shiftCount).toBe(1);
    expect(days.slice(1).every((d) => d.shiftCount === 0)).toBe(true);
  });

  it('spans however far the counts reach beyond minDays', () => {
    const base = today();
    const counts = [
      { date: base.toISOString(), count: 2 },
      { date: addDays(base, 10).toISOString(), count: 4 },
    ];

    const days = getDayStripDaysFromCounts(counts, { minDays: 3 });

    expect(days).toHaveLength(11);
    expect(days[0]?.shiftCount).toBe(2);
    expect(days[10]?.shiftCount).toBe(4);
  });

  it('drops a count that falls before today when includePast is not set', () => {
    const base = today();
    const counts = [
      { date: addDays(base, -2).toISOString(), count: 9 },
      { date: addDays(base, 1).toISOString(), count: 1 },
    ];

    const days = getDayStripDaysFromCounts(counts, { minDays: 1 });

    expect(days).toHaveLength(2);
    expect(days[0]?.date.getTime()).toBe(base.getTime());
    expect(days[0]?.shiftCount).toBe(0);
    expect(days[1]?.date.getTime()).toBe(addDays(base, 1).getTime());
    expect(days[1]?.shiftCount).toBe(1);
    expect(days.some((d) => d.shiftCount === 9)).toBe(false);
  });

  it('keeps a past count when includePast is set', () => {
    const base = today();
    const counts = [{ date: addDays(base, -2).toISOString(), count: 9 }];

    const days = getDayStripDaysFromCounts(counts, {
      minDays: 1,
      includePast: true,
    });

    expect(days[0]?.date.getTime()).toBe(addDays(base, -2).getTime());
    expect(days[0]?.shiftCount).toBe(9);
  });

  it('returns an all-zero minDays window when there are no counts', () => {
    const days = getDayStripDaysFromCounts([], { minDays: 4 });

    expect(days).toHaveLength(4);
    expect(days.every((d) => d.shiftCount === 0)).toBe(true);
  });
});

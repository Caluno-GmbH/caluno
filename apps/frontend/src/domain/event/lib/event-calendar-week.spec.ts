import { describe, expect, it } from 'bun:test';
import { toWeekParam } from '@/domain/shift/lib/shift-instances';
import { findAdjacentShiftWeek, pickInitialWeek } from './event-calendar-week';

const now = new Date('2026-09-16T10:00:00.000Z');
const eventStartsAt = new Date('2026-11-04T09:00:00.000Z');

describe('pickInitialWeek', () => {
  it('prefers the current week when it has an instance', () => {
    const result = pickInitialWeek({
      instanceStarts: ['2026-09-17T08:00:00.000Z'],
      now,
      eventStartsAt,
    });
    expect(toWeekParam(result)).toBe('2026-09-14');
  });

  it('falls back to the first week with shifts, even in the future', () => {
    const result = pickInitialWeek({
      instanceStarts: ['2026-09-29T08:00:00.000Z', '2026-10-06T08:00:00.000Z'],
      now,
      eventStartsAt,
    });
    expect(toWeekParam(result)).toBe('2026-09-28');
  });

  it('picks the earliest week, not the nearest one', () => {
    const result = pickInitialWeek({
      instanceStarts: ['2026-09-01T08:00:00.000Z', '2026-10-06T08:00:00.000Z'],
      now,
      eventStartsAt,
    });
    expect(toWeekParam(result)).toBe('2026-08-31');
  });

  it('uses the event start week when there are no instances', () => {
    const result = pickInitialWeek({
      instanceStarts: [],
      now,
      eventStartsAt,
    });
    expect(toWeekParam(result)).toBe('2026-11-02');
  });

  it('keeps a Sunday-evening instance in the week containing Sunday', () => {
    const result = pickInitialWeek({
      instanceStarts: ['2026-09-13T18:00:00.000Z'],
      now: new Date('2026-09-13T12:00:00.000Z'),
      eventStartsAt,
    });
    expect(toWeekParam(result)).toBe('2026-09-07');
  });
});

describe('findAdjacentShiftWeek', () => {
  const weekStart = new Date('2026-09-14T00:00:00.000+02:00');

  it('returns the next week with shifts when one exists', () => {
    const result = findAdjacentShiftWeek(
      ['2026-09-01T08:00:00.000Z', '2026-10-06T08:00:00.000Z'],
      weekStart,
    );
    expect(result?.direction).toBe('next');
    expect(result && toWeekParam(result.weekStart)).toBe('2026-10-05');
  });

  it('falls back to the latest previous week', () => {
    const result = findAdjacentShiftWeek(
      ['2026-09-01T08:00:00.000Z'],
      weekStart,
    );
    expect(result?.direction).toBe('previous');
    expect(result && toWeekParam(result.weekStart)).toBe('2026-08-31');
  });

  it('returns null without instances', () => {
    expect(findAdjacentShiftWeek([], weekStart)).toBeNull();
  });
});

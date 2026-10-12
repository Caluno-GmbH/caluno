import { describe, expect, it } from 'bun:test';
import { fillAssignmentWindow, startHasPassed } from './todo-fill-filter';

describe('fillAssignmentWindow', () => {
  it('starts at the Berlin calendar day and includes the last preset day', () => {
    const window = fillAssignmentWindow(
      new Date('2026-10-07T22:30:00.000Z'),
      14,
    );
    expect(window.start.toISOString()).toBe('2026-10-07T22:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-10-22T22:00:00.000Z');
  });
});

describe('startHasPassed', () => {
  const now = new Date('2026-10-08T20:00:00.000Z');

  it('excludes a shift that started one minute ago', () => {
    expect(startHasPassed(new Date('2026-10-08T19:59:00.000Z'), now)).toBe(
      true,
    );
  });

  it('keeps a shift that starts in one minute', () => {
    expect(startHasPassed(new Date('2026-10-08T20:01:00.000Z'), now)).toBe(
      false,
    );
  });

  it('excludes a shift that started at 21:00 and is still running after midnight', () => {
    const startsAt = new Date('2026-10-08T19:00:00.000Z');
    const duringShift = new Date('2026-10-08T23:30:00.000Z');
    expect(startHasPassed(startsAt, duringShift)).toBe(true);
    expect(startHasPassed(startsAt, new Date('2026-10-08T18:00:00.000Z'))).toBe(
      false,
    );
  });
});

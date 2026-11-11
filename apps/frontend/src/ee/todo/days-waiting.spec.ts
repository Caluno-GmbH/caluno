import { describe, expect, it } from 'bun:test';
import { daysWaiting } from './days-waiting';

describe('daysWaiting', () => {
  const now = new Date('2026-10-07T12:00:00.000Z');

  it('counts calendar days since the request in the app timezone', () => {
    expect(daysWaiting('2026-10-07T08:00:00.000Z', now)).toBe(0);
    expect(daysWaiting('2026-10-04T10:00:00.000Z', now)).toBe(3);
  });

  it('does not go negative for a future timestamp', () => {
    expect(daysWaiting('2026-10-08T08:00:00.000Z', now)).toBe(0);
  });

  it('returns nothing when the request date is missing', () => {
    expect(daysWaiting(undefined, now)).toBeUndefined();
    expect(daysWaiting('not-a-date', now)).toBeUndefined();
  });
});

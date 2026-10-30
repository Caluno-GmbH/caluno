import { describe, expect, it } from 'bun:test';
import { entryDurationMinutes, sumDurationMinutes } from '../location';

describe('entryDurationMinutes', () => {
  it('returns rounded whole minutes for a closed entry', () => {
    expect(
      entryDurationMinutes({
        startedAt: '2026-10-01T09:00:00.000Z',
        endedAt: '2026-10-01T10:30:40.000Z',
      }),
    ).toBe(91); // 90.67 min, rounded
  });
  it('returns null for an open entry (no endedAt)', () => {
    expect(
      entryDurationMinutes({ startedAt: '2026-10-01T09:00:00.000Z' }),
    ).toBeNull();
    expect(
      entryDurationMinutes({
        startedAt: '2026-10-01T09:00:00.000Z',
        endedAt: null,
      }),
    ).toBeNull();
  });
});

describe('sumDurationMinutes', () => {
  it('sums closed entries and ignores open ones', () => {
    expect(
      sumDurationMinutes([
        {
          startedAt: '2026-10-01T09:00:00.000Z',
          endedAt: '2026-10-01T10:00:00.000Z',
        },
        { startedAt: '2026-10-01T09:00:00.000Z', endedAt: null },
        {
          startedAt: '2026-10-01T11:00:00.000Z',
          endedAt: '2026-10-01T11:30:00.000Z',
        },
      ]),
    ).toBe(90);
  });
});

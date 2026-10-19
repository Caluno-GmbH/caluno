import { describe, expect, it } from 'bun:test';
import {
  type DirectCheckOutEntry,
  resolveDirectCheckOutEntryId,
} from '../direct-check-out';

const TZ = 'Europe/Berlin';

function entry(
  id: string,
  startedAt: string,
  instance?: { actualStartsAt: string; actualEndsAt: string } | null,
): DirectCheckOutEntry {
  return instance === undefined
    ? { id, startedAt }
    : { id, startedAt, shiftInstance: instance };
}

function resolve(entries: DirectCheckOutEntry[], now: string) {
  return resolveDirectCheckOutEntryId(entries, new Date(now), TZ);
}

describe('resolveDirectCheckOutEntryId', () => {
  describe('with a shift instance', () => {
    it('returns the entry whose instance runs today', () => {
      const e = entry('e1', '2026-10-16T08:05:00Z', {
        actualStartsAt: '2026-10-16T08:00:00Z',
        actualEndsAt: '2026-10-16T12:00:00Z',
      });
      expect(resolve([e], '2026-10-16T09:00:00Z')).toBe('e1');
    });

    it('keeps an overnight shift today after midnight Berlin', () => {
      const e = entry('e1', '2026-10-16T20:05:00Z', {
        actualStartsAt: '2026-10-16T20:00:00Z',
        actualEndsAt: '2026-10-17T00:00:00Z',
      });
      expect(resolve([e], '2026-10-16T23:30:00Z')).toBe('e1');
    });

    it('ignores startedAt: early check-in the evening before counts on the shift day', () => {
      const e = entry('e1', '2026-10-15T21:50:00Z', {
        actualStartsAt: '2026-10-16T06:00:00Z',
        actualEndsAt: '2026-10-16T10:00:00Z',
      });
      expect(resolve([e], '2026-10-16T07:00:00Z')).toBe('e1');
    });

    it('is not today the same evening before the shift day', () => {
      const e = entry('e1', '2026-10-15T21:50:00Z', {
        actualStartsAt: '2026-10-16T06:00:00Z',
        actualEndsAt: '2026-10-16T10:00:00Z',
      });
      expect(resolve([e], '2026-10-15T21:55:00Z')).toBeNull();
    });

    it('is not today when the instance was on an earlier day', () => {
      const e = entry('e1', '2026-10-14T08:00:00Z', {
        actualStartsAt: '2026-10-14T08:00:00Z',
        actualEndsAt: '2026-10-14T12:00:00Z',
      });
      expect(resolve([e], '2026-10-16T09:00:00Z')).toBeNull();
    });

    it('is today on a middle day of a multi-day instance', () => {
      const e = entry('e1', '2026-10-14T08:00:00Z', {
        actualStartsAt: '2026-10-14T08:00:00Z',
        actualEndsAt: '2026-10-16T16:00:00Z',
      });
      expect(resolve([e], '2026-10-15T12:00:00Z')).toBe('e1');
    });

    it('is inclusive of the end day when the instance ends at midnight Berlin', () => {
      const e = entry('e1', '2026-10-16T18:00:00Z', {
        actualStartsAt: '2026-10-16T18:00:00Z',
        actualEndsAt: '2026-10-16T22:00:00Z',
      });
      expect(resolve([e], '2026-10-16T22:10:00Z')).toBe('e1');
    });
  });

  describe('General check-in (no shift instance)', () => {
    for (const [label, instance] of [
      ['null', null],
      ['omitted', undefined],
    ] as const) {
      it(`is today when startedAt is today (${label} instance)`, () => {
        const e = entry('e1', '2026-10-16T08:00:00Z', instance);
        expect(resolve([e], '2026-10-16T12:00:00Z')).toBe('e1');
      });
    }

    it('is not today when startedAt was on an earlier day', () => {
      const e = entry('e1', '2026-10-15T08:00:00Z', null);
      expect(resolve([e], '2026-10-16T12:00:00Z')).toBeNull();
    });

    it('compares Berlin days, not UTC days', () => {
      const e = entry('e1', '2026-10-15T21:30:00Z', null);
      expect(resolve([e], '2026-10-15T23:30:00Z')).toBeNull();
    });

    it('handles startedAt with an explicit offset', () => {
      const e = entry('e1', '2026-10-16T01:00:00+02:00', null);
      expect(resolve([e], '2026-10-16T12:00:00Z')).toBe('e1');
    });
  });

  describe('DST end (Berlin clocks go back 2026-10-25)', () => {
    const e = entry('e1', '2026-10-24T22:30:00Z', {
      actualStartsAt: '2026-10-24T22:30:00Z',
      actualEndsAt: '2026-10-25T03:00:00Z',
    });

    it('is today during the repeated hour', () => {
      expect(resolve([e], '2026-10-25T00:30:00Z')).toBe('e1');
    });

    it('is today after the clocks go back', () => {
      expect(resolve([e], '2026-10-25T02:30:00Z')).toBe('e1');
    });

    it('is not today the next Berlin day', () => {
      expect(resolve([e], '2026-10-25T23:30:00Z')).toBeNull();
    });
  });

  describe('number of open entries', () => {
    const today = (id: string) =>
      entry(id, '2026-10-16T08:00:00Z', {
        actualStartsAt: '2026-10-16T08:00:00Z',
        actualEndsAt: '2026-10-16T12:00:00Z',
      });
    const now = '2026-10-16T09:00:00Z';

    it('returns null for two entries both today', () => {
      expect(resolve([today('e1'), today('e2')], now)).toBeNull();
    });

    it('returns null for a today entry plus a forgotten check-out', () => {
      const forgotten = entry('e2', '2026-10-14T08:00:00Z', {
        actualStartsAt: '2026-10-14T08:00:00Z',
        actualEndsAt: '2026-10-14T12:00:00Z',
      });
      expect(resolve([today('e1'), forgotten], now)).toBeNull();
    });

    it('returns null for an empty list', () => {
      expect(resolve([], now)).toBeNull();
    });
  });
});

import { describe, expect, it } from 'bun:test';
import type { EligibleTimeEntry } from '@repo/data';
import { formats } from '../../../lib/formatting/formats';
import {
  contractPeriodForLifespan,
  hoursBetween,
  mapEligibleTimeEntry,
} from './creation-modal.utils';

describe('contractPeriodForLifespan', () => {
  it('covers the single Berlin month of an MM/YYYY string', () => {
    expect(contractPeriodForLifespan('08/2026')).toEqual({
      periodStart: '2026-07-31T22:00:00.000Z',
      periodEnd: '2026-08-31T22:00:00.000Z',
    });
  });

  it('covers the full Berlin calendar year of a YYYY string', () => {
    expect(contractPeriodForLifespan('2026')).toEqual({
      periodStart: '2025-12-31T23:00:00.000Z',
      periodEnd: '2026-12-31T23:00:00.000Z',
    });
  });

  it('covers a stated day range with an exclusive end', () => {
    expect(contractPeriodForLifespan('01.08.2026–15.08.2026')).toEqual({
      periodStart: '2026-07-31T22:00:00.000Z',
      periodEnd: '2026-08-15T22:00:00.000Z',
    });
  });

  it('returns undefined when the string does not parse', () => {
    expect(contractPeriodForLifespan('not-a-date')).toBeUndefined();
  });

  it('returns undefined for an empty entry', () => {
    expect(contractPeriodForLifespan('')).toBeUndefined();
  });
});

describe('hoursBetween', () => {
  it('computes hours between two timestamps', () => {
    expect(hoursBetween('2026-07-05T09:00:00', '2026-07-05T13:00:00')).toBe(4);
  });

  it('rounds to hundredths', () => {
    expect(hoursBetween('2026-07-05T09:00:00', '2026-07-05T09:50:00')).toBe(
      0.83,
    );
  });
});

function makeEntry(
  overrides: Partial<EligibleTimeEntry> = {},
): EligibleTimeEntry {
  return {
    id: 'te-1',
    startedAt: '2026-07-05T09:00:00.000Z',
    endedAt: '2026-07-05T13:00:00.000Z',
    notes: null,
    shiftInstance: {
      id: 'si-1',
      master: { title: 'Sonntagsdienst' },
    },
    ...overrides,
  };
}

describe('mapEligibleTimeEntry', () => {
  it('maps a completed entry to shift name, hours and a combined date/time range', () => {
    expect(mapEligibleTimeEntry(makeEntry(), formats('de'))).toEqual({
      id: 'te-1',
      shiftName: 'Sonntagsdienst',
      dateTime: '05.07.2026, 11:00–15:00',
      hours: 4,
    });
  });

  it('falls back to notes when there is no shift instance', () => {
    const entry = mapEligibleTimeEntry(
      makeEntry({ shiftInstance: null, notes: 'Ad-hoc Einsatz' }),
      formats('de'),
    );
    expect(entry.shiftName).toBe('Ad-hoc Einsatz');
  });

  it('treats a still-open entry (no endedAt) as zero hours', () => {
    const entry = mapEligibleTimeEntry(
      makeEntry({ endedAt: null }),
      formats('de'),
    );
    expect(entry.hours).toBe(0);
    expect(entry.dateTime).toBe('05.07.2026, 11:00');
  });
});

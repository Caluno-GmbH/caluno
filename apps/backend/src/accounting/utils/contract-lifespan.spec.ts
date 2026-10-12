import { describe, expect, it } from 'bun:test';
import { parseLifespanShape } from '@repo/lifespan';
import { startOfAppDay } from '../../shift/utils/app-time';
import { billingYearBounds } from './billing-period';
import {
  draftPeriodForAnchor,
  formatLifespanForPeriod,
} from './contract-lifespan';

const at = (iso: string) => new Date(iso);

describe('draftPeriodForAnchor', () => {
  it('gives the calendar year of the anchor for a year template', () => {
    expect(
      draftPeriodForAnchor('2026', at('2027-03-10T10:00:00.000Z')),
    ).toEqual(billingYearBounds(2027));
  });

  it('gives the calendar month of the anchor for a month template', () => {
    // Template says 10/2026, the entry is in December: the draft is December.
    expect(
      draftPeriodForAnchor('10/2026', at('2026-12-15T12:00:00.000Z')),
    ).toEqual({
      start: startOfAppDay(2026, 11, 1),
      end: startOfAppDay(2027, 0, 1),
    });
  });

  it('keeps a range that contains the anchor', () => {
    expect(
      draftPeriodForAnchor(
        '05.10.2026–11.10.2026',
        at('2026-10-07T10:00:00.000Z'),
      ),
    ).toEqual({
      start: startOfAppDay(2026, 9, 5),
      end: startOfAppDay(2026, 9, 12),
    });
  });

  it('falls back to the anchor year when the range does not contain the anchor', () => {
    expect(
      draftPeriodForAnchor(
        '05.10.2026–11.10.2026',
        at('2026-10-20T10:00:00.000Z'),
      ),
    ).toEqual(billingYearBounds(2026));
  });

  it('includes the last day of a range and excludes the instant after it', () => {
    const lastMoment = at('2026-10-11T21:59:59.999Z'); // 23:59:59.999 Berlin, 11.10.
    const firstAfter = at('2026-10-11T22:00:00.000Z'); // 00:00 Berlin, 12.10.
    expect(
      draftPeriodForAnchor('05.10.2026–11.10.2026', lastMoment).end,
    ).toEqual(startOfAppDay(2026, 9, 12));
    expect(draftPeriodForAnchor('05.10.2026–11.10.2026', firstAfter)).toEqual(
      billingYearBounds(2026),
    );
  });

  it('uses the Berlin date: 00:30 on 1 January is the new year, 23:30 on 31 December is the old one', () => {
    expect(
      draftPeriodForAnchor(undefined, at('2026-12-31T23:30:00.000Z')),
    ).toEqual(billingYearBounds(2027));
    expect(
      draftPeriodForAnchor(undefined, at('2026-12-31T22:30:00.000Z')),
    ).toEqual(billingYearBounds(2026));
    expect(
      draftPeriodForAnchor('10/2026', at('2026-12-31T23:30:00.000Z')),
    ).toEqual({
      start: startOfAppDay(2027, 0, 1),
      end: startOfAppDay(2027, 1, 1),
    });
  });

  it('falls back to the calendar year for empty, missing and unreadable values', () => {
    const anchor = at('2026-06-15T10:00:00.000Z');
    for (const value of [
      undefined,
      '',
      '   ',
      'garbage',
      '13/2026',
      '31.02.2026–05.03.2026',
    ]) {
      expect(draftPeriodForAnchor(value, anchor)).toEqual(
        billingYearBounds(2026),
      );
    }
  });
});

describe('formatLifespanForPeriod', () => {
  it('prints a whole calendar year as YYYY', () => {
    expect(formatLifespanForPeriod(billingYearBounds(2026))).toBe('2026');
  });

  it('prints a whole calendar month as MM/YYYY', () => {
    expect(
      formatLifespanForPeriod({
        start: startOfAppDay(2026, 9, 1),
        end: startOfAppDay(2026, 10, 1),
      }),
    ).toBe('10/2026');
  });

  it('prints anything else as a day range with an en dash', () => {
    expect(
      formatLifespanForPeriod({
        start: startOfAppDay(2026, 9, 5),
        end: startOfAppDay(2026, 9, 12),
      }),
    ).toBe('05.10.2026–11.10.2026');
  });

  it('prints the 25-hour day when clocks go back as a one-day range', () => {
    expect(
      formatLifespanForPeriod({
        start: startOfAppDay(2026, 9, 25),
        end: startOfAppDay(2026, 9, 26),
      }),
    ).toBe('25.10.2026–25.10.2026');
  });

  it('prints something the shared parser reads back as the same kind', () => {
    const periods = [
      billingYearBounds(2027),
      { start: startOfAppDay(2026, 11, 1), end: startOfAppDay(2027, 0, 1) },
      { start: startOfAppDay(2026, 2, 3), end: startOfAppDay(2026, 2, 20) },
    ];
    expect(
      periods.map((p) => parseLifespanShape(formatLifespanForPeriod(p))?.kind),
    ).toEqual(['year', 'month', 'range']);
  });
});

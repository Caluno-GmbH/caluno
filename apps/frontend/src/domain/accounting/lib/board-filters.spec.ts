import { describe, expect, it } from 'bun:test';
import {
  docVisibleInRange,
  getReadyToGoDocs,
  isTimesheetNonCompliant,
} from './board-filters';

const timesheet = (periodStart: Date, periodEnd: Date, lastAction: Date) =>
  ({
    id: 't1',
    status: 'timesheet-ready',
    periodLabel: 'August 2026',
    periodStart,
    periodEnd,
    lastActionDate: lastAction,
  }) as never;

/** How the period picker builds a month: the last day at midnight. */
const august = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) };
const september = { from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) };

describe('docVisibleInRange', () => {
  // The timesheet the bug was reported against: August hours, countersigned in
  // September.
  const augustTimesheet = timesheet(
    new Date(2026, 7, 1),
    new Date(2026, 7, 31),
    new Date(2026, 8, 28, 17, 50),
  );

  it('Finds a timesheet under the month it covers, whenever it was signed', () => {
    expect(docVisibleInRange(augustTimesheet, august)).toBe(true);
  });

  it('Does not file it under the month it happened to be signed in', () => {
    expect(docVisibleInRange(augustTimesheet, september)).toBe(false);
  });

  it('Includes the last day of the range', () => {
    // The range ends at midnight on the 30th; a period reaching into that day
    // is still within it.
    const endsOnTheLastDay = timesheet(
      new Date(2026, 8, 30),
      new Date(2026, 8, 30, 23, 59),
      new Date(2026, 8, 30, 14, 0),
    );

    expect(docVisibleInRange(endsOnTheLastDay, september)).toBe(true);
  });

  it('Keeps a document whose period overlaps the range at either edge', () => {
    const spansAugustIntoSeptember = timesheet(
      new Date(2026, 7, 20),
      new Date(2026, 8, 10),
      new Date(2026, 8, 11),
    );

    expect(docVisibleInRange(spansAugustIntoSeptember, august)).toBe(true);
    expect(docVisibleInRange(spansAugustIntoSeptember, september)).toBe(true);
  });

  it('Never hides a document that has no period of its own', () => {
    const noPeriod = {
      id: 'x',
      status: 'timesheet-generate',
      periodLabel: '',
    } as never;

    expect(docVisibleInRange(noPeriod, august)).toBe(true);
  });

  it('Shows everything when no range is selected', () => {
    expect(docVisibleInRange(augustTimesheet, undefined)).toBe(true);
  });

  it('Matches a contract on its coverage year, not on an exact day', () => {
    const contract = {
      id: 'c1',
      status: 'contract-active',
      periodLabel: '2026',
      lastActionDate: new Date(2026, 0, 15),
    } as never;

    expect(docVisibleInRange(contract, august)).toBe(true);
    expect(
      docVisibleInRange(contract, {
        from: new Date(2025, 7, 1),
        to: new Date(2025, 7, 31),
      }),
    ).toBe(false);
  });
});

describe('isTimesheetNonCompliant', () => {
  const doc = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'd',
      status: 'timesheet-countersign',
      periodLabel: 'Oktober 2026',
      pauschale: 'ehrenamt',
      ...overrides,
    }) as never;

  // The flag is the backend's live per-hour answer; whether some other active
  // contract of the Pauschale exists is not an input any more (VOLI-1588).
  it('follows the document flag', () => {
    expect(isTimesheetNonCompliant(doc({ isNonCompliant: true }))).toBe(true);
    expect(isTimesheetNonCompliant(doc({ isNonCompliant: false }))).toBe(false);
  });

  it('is false for a declined timesheet and for anything that is not a timesheet', () => {
    expect(
      isTimesheetNonCompliant(
        doc({ status: 'timesheet-declined', isNonCompliant: true }),
      ),
    ).toBe(false);
    expect(
      isTimesheetNonCompliant(
        doc({ status: 'contract-active', isNonCompliant: true }),
      ),
    ).toBe(false);
  });

  it('treats a timesheet without a flag as compliant rather than guessing', () => {
    expect(isTimesheetNonCompliant(doc())).toBe(false);
  });
});

describe('getReadyToGoDocs', () => {
  const ready = (pauschale: string, start: Date, end: Date, id = 't') =>
    ({
      id,
      status: 'timesheet-ready',
      periodLabel: 'Oktober 2026',
      periodStart: start,
      periodEnd: end,
      pauschale,
    }) as never;

  const contract = (
    id: string,
    status: string,
    start: Date | undefined,
    end: Date | undefined,
    pauschale = 'uebungsleiter',
  ) =>
    ({
      id,
      status,
      periodLabel: '2026',
      periodStart: start,
      periodEnd: end,
      pauschale,
    }) as never;

  const volunteer = (documents: unknown[]) =>
    ({
      id: 'v',
      name: 'V',
      initials: 'V',
      usedAmount: 0,
      totalCap: 0,
      documents,
    }) as never;

  const october = [new Date(2026, 9, 1), new Date(2026, 10, 1)] as const;

  it('shows every contract that overlaps the timesheet, oldest first', () => {
    const later = contract(
      'b',
      'contract-active',
      new Date(2026, 9, 15),
      new Date(2026, 10, 11),
    );
    const earlier = contract(
      'a',
      'contract-expired',
      new Date(2026, 8, 10),
      new Date(2026, 9, 10),
    );

    const rows = getReadyToGoDocs(
      volunteer([later, ready('uebungsleiter', ...october), earlier]),
      undefined,
    );

    expect(rows.map((r) => r.id)).toEqual(['t', 'a', 'b']);
  });

  it('leaves out contracts of another allowance type, outside the period, or declined', () => {
    const rows = getReadyToGoDocs(
      volunteer([
        ready('uebungsleiter', ...october),
        contract(
          'declined',
          'contract-declined',
          new Date(2026, 9, 6),
          new Date(2026, 10, 1),
        ),
        contract(
          'before',
          'contract-active',
          new Date(2026, 0, 1),
          new Date(2026, 8, 1),
        ),
        contract(
          'other-type',
          'contract-active',
          new Date(2026, 8, 1),
          new Date(2026, 11, 1),
          'ehrenamt',
        ),
        contract(
          'same',
          'contract-active',
          new Date(2026, 8, 1),
          new Date(2026, 9, 15),
        ),
      ]),
      undefined,
    );

    expect(rows.map((r) => r.id)).toEqual(['t', 'same']);
  });

  it('keeps the first contract of the type when none states a period that overlaps', () => {
    const rows = getReadyToGoDocs(
      volunteer([
        ready('uebungsleiter', ...october),
        contract('only', 'contract-active', undefined, undefined),
      ]),
      undefined,
    );

    expect(rows.map((r) => r.id)).toEqual(['t', 'only']);
  });

  it('shows a missing placeholder when the type has no contract at all', () => {
    const rows = getReadyToGoDocs(
      volunteer([ready('uebungsleiter', ...october)]),
      undefined,
    );

    expect(rows.map((r) => r.status)).toEqual([
      'timesheet-ready',
      'contract-missing',
    ]);
  });
});

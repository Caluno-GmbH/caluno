import { describe, expect, it } from 'bun:test';
import { docVisibleInRange } from './reimbursements-board';

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

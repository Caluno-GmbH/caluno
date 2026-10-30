import { describe, expect, it } from 'bun:test';
import { toTimesheetDateRange } from './timesheets-date-range';

// parseAsIsoDate produces UTC-midnight Dates from YYYY-MM-DD strings.
const utcMidnight = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('toTimesheetDateRange', () => {
  it('returns empty object when both inputs are null', () => {
    expect(toTimesheetDateRange(null, null)).toEqual({});
  });

  it('includes only dateFrom when dateTo is null', () => {
    const result = toTimesheetDateRange(utcMidnight('2024-01-15'), null);
    expect(result.dateTo).toBeUndefined();
    expect(result.dateFrom).toBeDefined();
  });

  it('includes only dateTo when dateFrom is null', () => {
    const result = toTimesheetDateRange(null, utcMidnight('2024-01-15'));
    expect(result.dateFrom).toBeUndefined();
    expect(result.dateTo).toBeDefined();
  });

  it('includes both when both inputs are non-null', () => {
    const result = toTimesheetDateRange(
      utcMidnight('2024-01-15'),
      utcMidnight('2024-01-20'),
    );
    expect(result.dateFrom).toBeDefined();
    expect(result.dateTo).toBeDefined();
  });

  it('dateFrom is Berlin midnight on the selected day — winter (UTC+1)', () => {
    // 2024-01-15 in Berlin is UTC+1, so Berlin midnight = 2024-01-14T23:00:00Z
    const result = toTimesheetDateRange(utcMidnight('2024-01-15'), null);
    expect(result.dateFrom).toBe('2024-01-14T23:00:00.000Z');
  });

  it('dateFrom is Berlin midnight on the selected day — summer (UTC+2)', () => {
    // 2024-07-10 in Berlin is UTC+2, so Berlin midnight = 2024-07-09T22:00:00Z
    const result = toTimesheetDateRange(utcMidnight('2024-07-10'), null);
    expect(result.dateFrom).toBe('2024-07-09T22:00:00.000Z');
  });

  it('dateTo is start of the day AFTER selected end — winter (UTC+1)', () => {
    // dateTo = 2024-01-15; day after in Berlin midnight = 2024-01-16T00:00 Berlin = 2024-01-15T23:00:00Z
    const result = toTimesheetDateRange(null, utcMidnight('2024-01-15'));
    expect(result.dateTo).toBe('2024-01-15T23:00:00.000Z');
  });

  it('dateTo is start of the day AFTER selected end — summer (UTC+2)', () => {
    // dateTo = 2024-07-10; day after in Berlin midnight = 2024-07-11T00:00 Berlin = 2024-07-10T22:00:00Z
    const result = toTimesheetDateRange(null, utcMidnight('2024-07-10'));
    expect(result.dateTo).toBe('2024-07-10T22:00:00.000Z');
  });

  it('full range — winter: an entry at 23:30 Berlin on dateTo day is within the range', () => {
    // User picks 2024-01-01 to 2024-01-31.
    // An entry at 2024-01-31T23:30 Berlin = 2024-01-31T22:30:00Z should be included.
    // dateTo becomes start of 2024-02-01 Berlin = 2024-01-31T23:00:00Z
    // 22:30Z < 23:00Z => included (backend: startedAt < dateTo).
    const result = toTimesheetDateRange(
      utcMidnight('2024-01-01'),
      utcMidnight('2024-01-31'),
    );
    const dateTo = new Date(result.dateTo!);
    const entryAt = new Date('2024-01-31T22:30:00Z'); // 23:30 Berlin
    expect(entryAt < dateTo).toBe(true);
  });

  it('full range — summer: an entry at 00:30 Berlin on day after dateTo is outside the range', () => {
    // User picks dateTo = 2024-07-10.
    // dateTo becomes start of 2024-07-11 Berlin = 2024-07-10T22:00:00Z
    // An entry at 2024-07-11T00:30 Berlin = 2024-07-10T22:30:00Z should be excluded.
    // 22:30Z > 22:00Z => excluded (backend: startedAt >= dateTo).
    const result = toTimesheetDateRange(null, utcMidnight('2024-07-10'));
    const dateTo = new Date(result.dateTo!);
    const entryAt = new Date('2024-07-10T22:30:00Z'); // 00:30 Berlin on July 11
    expect(entryAt < dateTo).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { serializeTimesheetsToCsv } from '../timesheets-csv';

const HEADERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

describe('serializeTimesheetsToCsv', () => {
  it('uses the injected headers as the first line', () => {
    const csv = serializeTimesheetsToCsv([], HEADERS);
    expect(csv.split('\n')[0]).toBe(
      '"A","B","C","D","E","F","G","H","I","J","K"',
    );
  });
  it('does not throw and emits blanks when volunteer and shift are null', () => {
    const entry = {
      volunteer: null,
      shiftInstance: null,
      organizationUnit: { street: null, zipCode: null, city: null },
      startedAt: '2026-10-01T09:00:00.000Z',
      endedAt: '2026-10-01T10:00:00.000Z',
      status: 'Closed',
      createdBy: null,
      notes: null,
    } as never;
    const rows = serializeTimesheetsToCsv([entry], HEADERS).split('\n');
    const row = rows[1] ?? '';
    expect(row.startsWith('"",""')).toBe(true); // empty name, empty email
    expect(row).toContain('"60"'); // duration minutes still computed
  });
});

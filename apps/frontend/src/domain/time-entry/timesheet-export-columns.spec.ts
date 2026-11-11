import { describe, expect, it } from 'bun:test';
import { TIMESHEET_EXPORT_COLUMNS } from './timesheet-export-columns';

const CANONICAL_IDS = [
  'volunteerName',
  'volunteerEmail',
  'shift',
  'assignment',
  'location',
  'startedAt',
  'endedAt',
  'duration',
  'status',
  'createdBy',
  'notes',
];

describe('TIMESHEET_EXPORT_COLUMNS', () => {
  it('exposes all timesheet columns with stable ids/order', () => {
    expect(TIMESHEET_EXPORT_COLUMNS.map((c) => c.id)).toEqual(CANONICAL_IDS);
  });

  it('marks volunteerName as required (optional: false, defaultOn: true)', () => {
    const col = TIMESHEET_EXPORT_COLUMNS.find((c) => c.id === 'volunteerName');
    expect(col?.optional).toBe(false);
    expect(col?.defaultOn).toBe(true);
  });

  it('marks all other columns as optional and defaultOn', () => {
    const others = TIMESHEET_EXPORT_COLUMNS.filter(
      (c) => c.id !== 'volunteerName',
    );
    for (const col of others) {
      expect(col.optional).toBe(true);
      expect(col.defaultOn).toBe(true);
    }
  });
});

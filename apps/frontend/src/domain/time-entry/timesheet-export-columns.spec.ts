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
  'volunteerDateOfBirth',
  'volunteerGender',
  'volunteerPhone',
  'volunteerAddress',
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
      (c) => c.id !== 'volunteerName' && !c.group,
    );
    for (const col of others) {
      expect(col.optional).toBe(true);
      expect(col.defaultOn).toBe(true);
    }
  });

  it('marks extended-group columns optional, default-off, grouped', () => {
    const group = TIMESHEET_EXPORT_COLUMNS.filter((c) => c.group === 'extendedUserInfo');
    expect(group.map((c) => c.id)).toEqual([
      'volunteerDateOfBirth', 'volunteerGender', 'volunteerPhone', 'volunteerAddress',
    ]);
    for (const col of group) {
      expect(col.optional).toBe(true);
      expect(col.defaultOn).toBe(false);
    }
  });
});

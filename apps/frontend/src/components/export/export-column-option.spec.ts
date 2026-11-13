import { describe, expect, it } from 'bun:test';
import {
  type ExportColumnOption,
  resolveSelectedColumns,
} from './export-column-option';

const OPTIONS: ExportColumnOption[] = [
  { id: 'name', label: 'Name', defaultOn: true, optional: false },
  { id: 'email', label: 'Email', defaultOn: true, optional: false },
  { id: 'phone', label: 'Phone', defaultOn: false, optional: true },
  { id: 'notes', label: 'Notes', defaultOn: true, optional: true },
];

describe('resolveSelectedColumns', () => {
  it('always includes required columns regardless of checks', () => {
    const result = resolveSelectedColumns(OPTIONS, []);
    expect(result).toContain('name');
    expect(result).toContain('email');
  });

  it('includes optional columns only when checked', () => {
    const withPhone = resolveSelectedColumns(OPTIONS, ['phone']);
    expect(withPhone).toContain('phone');
    expect(withPhone).not.toContain('notes');

    const withNone = resolveSelectedColumns(OPTIONS, []);
    expect(withNone).not.toContain('phone');
    expect(withNone).not.toContain('notes');
  });

  it('keeps canonical column order', () => {
    // Pass checkedIds out of order; output must follow options array order.
    const result = resolveSelectedColumns(OPTIONS, ['notes', 'phone']);
    expect(result).toEqual(['name', 'email', 'phone', 'notes']);
  });
});

const GROUPED: ExportColumnOption[] = [
  { id: 'name', label: 'Name', defaultOn: true, optional: false },
  {
    id: 'dob',
    label: 'DOB',
    defaultOn: false,
    optional: true,
    group: 'extendedUserInfo',
  },
];

describe('resolveSelectedColumns with groups', () => {
  it('excludes grouped columns when the group is disabled or absent', () => {
    expect(resolveSelectedColumns(GROUPED, ['dob'])).toEqual(['name']);
    expect(
      resolveSelectedColumns(GROUPED, ['dob'], { extendedUserInfo: false }),
    ).toEqual(['name']);
  });

  it('includes a checked grouped column only when its group is enabled', () => {
    expect(
      resolveSelectedColumns(GROUPED, ['dob'], { extendedUserInfo: true }),
    ).toEqual(['name', 'dob']);
    expect(
      resolveSelectedColumns(GROUPED, [], { extendedUserInfo: true }),
    ).toEqual(['name']);
  });
});

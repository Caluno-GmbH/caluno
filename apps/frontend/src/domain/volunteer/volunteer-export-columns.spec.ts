import { describe, expect, it } from 'bun:test';
import { VOLUNTEER_EXPORT_COLUMNS } from './volunteer-export-columns';

describe('VOLUNTEER_EXPORT_COLUMNS', () => {
  it('has the 7 canonical ids in order', () => {
    expect(VOLUNTEER_EXPORT_COLUMNS.map((c) => c.id)).toEqual([
      'name',
      'email',
      'roles',
      'dateOfBirth',
      'gender',
      'phone',
      'address',
    ]);
  });

  it('keeps name, email, roles required', () => {
    const required = VOLUNTEER_EXPORT_COLUMNS.filter((c) => !c.optional);
    expect(required.map((c) => c.id)).toEqual(['name', 'email', 'roles']);
    for (const col of required) {
      expect(col.defaultOn).toBe(true);
    }
  });

  it('marks personal fields optional with defaultOn false', () => {
    const personal = VOLUNTEER_EXPORT_COLUMNS.filter((c) => c.optional);
    expect(personal.map((c) => c.id)).toEqual([
      'dateOfBirth',
      'gender',
      'phone',
      'address',
    ]);
    for (const col of personal) {
      expect(col.optional).toBe(true);
      expect(col.defaultOn).toBe(false);
    }
  });
});

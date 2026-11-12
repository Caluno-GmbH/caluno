import { describe, expect, it } from 'bun:test';
import { EXTENDED_USER_GROUP, extendedUserColumnMetas } from './extended-user-columns';

it('offers all four volunteer profile fields when none are already present', () => {
  const metas = extendedUserColumnMetas(new Set());
  expect(metas.map((m) => m.id)).toEqual([
    'volunteerDateOfBirth', 'volunteerGender', 'volunteerPhone', 'volunteerAddress',
  ]);
  for (const m of metas) {
    expect(m.optional).toBe(true);
    expect(m.defaultOn).toBe(false);
    expect(m.group).toBe(EXTENDED_USER_GROUP);
  }
});

it('drops a field the table already exposes', () => {
  const metas = extendedUserColumnMetas(new Set(['phone']));
  expect(metas.map((m) => m.id)).not.toContain('volunteerPhone');
  expect(metas.map((m) => m.profileKey)).toEqual(['dateOfBirth', 'gender', 'address']);
});

import { describe, expect, it } from 'bun:test';
import {
  calculateAge,
  formatDateOfBirthWithAge,
} from './volunteer-profile-format';

const now = new Date('2026-11-04T00:00:00Z');

describe('calculateAge', () => {
  it('returns whole years for a past birthdate', () => {
    expect(calculateAge('1990-05-12', now)).toBe(36);
  });
  it('has not counted a birthday later this year', () => {
    expect(calculateAge('1990-12-01', now)).toBe(35);
  });
  it('returns null for null, empty, invalid, or future dates', () => {
    expect(calculateAge(null, now)).toBeNull();
    expect(calculateAge('', now)).toBeNull();
    expect(calculateAge('not-a-date', now)).toBeNull();
    expect(calculateAge('2099-01-01', now)).toBeNull();
  });
});

describe('formatDateOfBirthWithAge', () => {
  it('joins formatted date and age', () => {
    expect(
      formatDateOfBirthWithAge('1990-05-12', now, () => '12.05.1990'),
    ).toBe('12.05.1990 · 36');
  });
  it('returns empty string when birthdate is missing', () => {
    expect(formatDateOfBirthWithAge(null, now, () => 'x')).toBe('');
  });
});

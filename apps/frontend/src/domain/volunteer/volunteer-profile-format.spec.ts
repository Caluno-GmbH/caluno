import { describe, expect, it } from 'bun:test';
import {
  calculateAge,
  formatDateOfBirthWithAge,
  formatVolunteerAddress,
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
  it('formats the exact calendar day of birth regardless of timezone', () => {
    const asLocalIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(formatDateOfBirthWithAge('1990-08-02', now, asLocalIso)).toBe(
      '1990-08-02 · 36',
    );
  });
});

describe('formatVolunteerAddress', () => {
  it('joins street, zip and city into "street, zip city"', () => {
    expect(
      formatVolunteerAddress({
        street: 'Main St',
        zip: '20095',
        city: 'Hamburg',
      }),
    ).toBe('Main St, 20095 Hamburg');
  });
  it('returns only city when street and zip are absent', () => {
    expect(formatVolunteerAddress({ city: 'Hamburg' })).toBe('Hamburg');
  });
  it('returns only street when zip and city are absent', () => {
    expect(formatVolunteerAddress({ street: 'Main St' })).toBe('Main St');
  });
  it('returns empty string when all parts are empty or null', () => {
    expect(
      formatVolunteerAddress({ street: null, zip: null, city: null }),
    ).toBe('');
    expect(formatVolunteerAddress({})).toBe('');
  });
});

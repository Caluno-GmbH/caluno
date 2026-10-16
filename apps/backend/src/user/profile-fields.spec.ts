import { describe, expect, it } from 'bun:test';
import { pickWritableProfileFields, toProfileFields } from './profile-fields';

describe('toProfileFields', () => {
  it('keeps column keys and skips empty values', () => {
    expect(
      toProfileFields({
        firstname: 'Ada',
        lastname: 'Lovelace',
        preferredName: '',
        email: 'ada@example.com',
        birthdate: '1815-12-10',
        accountHolder: 'Ada Lovelace',
        iban: null,
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace',
      email: 'ada@example.com',
      birthdate: '1815-12-10',
      // Equal-to-name stored value still resolves as the effective holder.
      accountHolder: 'Ada Lovelace',
    });
  });

  it('fills accountHolder from the derived name when unset', () => {
    expect(
      toProfileFields({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: null,
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace',
      accountHolder: 'Ada Lovelace',
    });
  });

  it('prefers an explicit accountHolder over the derived name', () => {
    expect(
      toProfileFields({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: 'A. Lovelace Trust',
      }).accountHolder,
    ).toBe('A. Lovelace Trust');
  });
});

describe('pickWritableProfileFields', () => {
  it('keeps writable columns and ignores email', () => {
    expect(
      pickWritableProfileFields({
        firstname: 'Ada',
        preferredName: 'A',
        birthdate: '1815-12-10',
        accountHolder: 'Ada Lovelace',
        email: 'should-not-write@example.com',
        unknown: 'ignored',
      }),
    ).toEqual({
      firstname: 'Ada',
      preferredName: 'A',
      birthdate: '1815-12-10',
      accountHolder: 'Ada Lovelace',
    });
  });

  it('does not invent keys that were absent from the input (merge, not wipe)', () => {
    expect(pickWritableProfileFields({ phone: '+49 30 123' })).toEqual({
      phone: '+49 30 123',
    });
  });
});

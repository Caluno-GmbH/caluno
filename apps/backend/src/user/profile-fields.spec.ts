import { describe, expect, it } from 'bun:test';
import { profileDataToUserColumns, toProfileDataMap } from './profile-fields';

describe('toProfileDataMap', () => {
  it('maps user columns to systemKeys and skips empty values', () => {
    expect(
      toProfileDataMap({
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
      'account-holder': 'Ada Lovelace',
    });
  });

  it('fills account-holder from the derived name when unset', () => {
    expect(
      toProfileDataMap({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: null,
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace',
      'account-holder': 'Ada Lovelace',
    });
  });

  it('prefers an explicit accountHolder over the derived name', () => {
    expect(
      toProfileDataMap({
        firstname: 'Ada',
        lastname: 'Lovelace',
        accountHolder: 'A. Lovelace Trust',
      })['account-holder'],
    ).toBe('A. Lovelace Trust');
  });
});

describe('profileDataToUserColumns', () => {
  it('maps writable systemKeys to columns and ignores email', () => {
    expect(
      profileDataToUserColumns({
        firstname: 'Ada',
        'preferred-name': 'A',
        birthdate: '1815-12-10',
        'account-holder': 'Ada Lovelace',
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
    expect(profileDataToUserColumns({ phone: '+49 30 123' })).toEqual({
      phone: '+49 30 123',
    });
  });
});

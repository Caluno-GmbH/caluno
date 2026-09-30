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
      'account-holder': 'Ada Lovelace',
    });
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
});

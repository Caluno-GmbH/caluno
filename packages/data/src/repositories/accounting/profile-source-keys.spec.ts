import { describe, expect, it } from 'bun:test';
import {
  PROFILE_SOURCE_TO_PROFILE_KEY,
  toMissingProfileKeys,
} from './profile-source-keys';

describe('toMissingProfileKeys', () => {
  it('maps all 9 template source keys to profile system keys', () => {
    expect(
      toMissingProfileKeys(Object.keys(PROFILE_SOURCE_TO_PROFILE_KEY)),
    ).toEqual([
      'firstname',
      'lastname',
      'street',
      'zip',
      'city',
      'birthdate',
      'iban',
      'account-holder',
      'bic',
    ]);
  });

  it('drops source keys the frontend does not know', () => {
    expect(
      toMissingProfileKeys(['volunteer_iban', 'org_name', 'not_a_source']),
    ).toEqual(['iban']);
  });

  it('removes duplicates', () => {
    expect(toMissingProfileKeys(['volunteer_zip', 'volunteer_zip'])).toEqual([
      'zip',
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(toMissingProfileKeys([])).toEqual([]);
  });
});

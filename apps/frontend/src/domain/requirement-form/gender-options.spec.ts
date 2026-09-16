import { describe, expect, it } from 'bun:test';
import {
  GENDER_OPTION_VALUES,
  hasFixedGenderOptions,
  isGenderOptionValue,
} from './gender-options';

describe('gender options', () => {
  it('defines the fixed option list in order', () => {
    expect(GENDER_OPTION_VALUES).toEqual([
      'female',
      'male',
      'diverse',
      'other',
      'prefer-not-to-say',
    ]);
  });

  it('accepts each option value', () => {
    for (const v of GENDER_OPTION_VALUES) {
      expect(isGenderOptionValue(v)).toBe(true);
    }
  });

  it('rejects arbitrary strings', () => {
    expect(isGenderOptionValue('Weiblich')).toBe(false);
    expect(isGenderOptionValue('')).toBe(false);
  });
});

describe('hasFixedGenderOptions', () => {
  it('is true only for the gender system key', () => {
    expect(hasFixedGenderOptions('gender')).toBe(true);
    expect(hasFixedGenderOptions('name')).toBe(false);
    expect(hasFixedGenderOptions('email')).toBe(false);
  });

  it('is false for missing keys', () => {
    expect(hasFixedGenderOptions(undefined)).toBe(false);
    expect(hasFixedGenderOptions(null)).toBe(false);
    expect(hasFixedGenderOptions('')).toBe(false);
  });
});

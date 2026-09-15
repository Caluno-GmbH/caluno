import { describe, expect, it } from 'bun:test';
import { GENDER_OPTION_VALUES, isGenderOptionValue } from './gender-options';

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

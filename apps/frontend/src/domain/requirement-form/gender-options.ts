export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'prefer-not-to-say',
] as const;

export type GenderOptionValue = (typeof GENDER_OPTION_VALUES)[number];

export const isGenderOptionValue = (v: string): v is GenderOptionValue =>
  (GENDER_OPTION_VALUES as readonly string[]).includes(v);

export const GENDER_PROFILE_KEY = 'gender';

/**
 * Gender is the only profile field with fixed, non-editable options: the field
 * editor must not offer an options UI for it, and rendering/validation inject
 * the fixed list by profile key.
 */
export const hasFixedGenderOptions = (profileKey?: string | null): boolean =>
  profileKey === GENDER_PROFILE_KEY;

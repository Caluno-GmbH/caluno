export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'other',
  'prefer-not-to-say',
] as const;

export type GenderOptionValue = (typeof GENDER_OPTION_VALUES)[number];

export const isGenderOptionValue = (v: string): v is GenderOptionValue =>
  (GENDER_OPTION_VALUES as readonly string[]).includes(v);

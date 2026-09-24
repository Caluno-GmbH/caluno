export const GENDER_SYSTEM_KEY = 'gender';

export const SYSTEM_PROFILE_KEYS = new Set<string>([
  'name',
  'lastname',
  'preferred-name',
  GENDER_SYSTEM_KEY,
  'email',
  'phone',
  'street',
  'zip',
  'city',
  'birth-date',
  'iban',
  'account-holder',
  'bic',
  'tax-id',
]);

/** Fixed option values for the gender system field. Mirrored in the frontend (gender-options.ts). */
export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'prefer-not-to-say',
] as const;

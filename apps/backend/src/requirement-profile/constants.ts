export const GENDER_PROFILE_KEY = 'gender';

export const PROFILE_KEYS = new Set<string>([
  'firstname',
  'lastname',
  'preferredName',
  GENDER_PROFILE_KEY,
  'email',
  'phone',
  'street',
  'zip',
  'city',
  'birthdate',
  'iban',
  'accountHolder',
  'bic',
]);

/** Fixed option values for the gender system field. Mirrored in the frontend (gender-options.ts). */
export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'prefer-not-to-say',
] as const;

import { SYSTEM_KEY_TO_USER_COLUMN } from '../user/profile-fields';

export const GENDER_SYSTEM_KEY = 'gender';

export const SYSTEM_PROFILE_KEYS = new Set(
  Object.keys(SYSTEM_KEY_TO_USER_COLUMN),
);

/** Fixed option values for the gender system field. Mirrored in the frontend (gender-options.ts). */
export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'prefer-not-to-say',
] as const;

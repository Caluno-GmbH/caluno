import type { DataSourceKey } from './template-body.types';

/**
 * Maps a template field's bound `source` to the user profile systemKey it
 * reads from. Mirrors the backend's PROFILE_SOURCE_TO_PROFILE_KEY
 * (apps/backend/src/accounting/services/document-template.types.ts) — the two
 * must stay in sync. The document's `missingProfileFields` carries these
 * source keys; the complete-profile sheet translates them to profile fields.
 */
export const PROFILE_SOURCE_TO_PROFILE_KEY = {
  volunteer_first_name: 'firstname',
  volunteer_last_name: 'lastname',
  volunteer_street: 'street',
  volunteer_zip: 'zip',
  volunteer_city: 'city',
  volunteer_dob: 'birthdate',
  volunteer_iban: 'iban',
  volunteer_account_holder: 'account-holder',
  volunteer_bic: 'bic',
} as const satisfies Partial<Record<DataSourceKey, string>>;

export type ProfileSourceKey = keyof typeof PROFILE_SOURCE_TO_PROFILE_KEY;
export type MissingProfileKey =
  (typeof PROFILE_SOURCE_TO_PROFILE_KEY)[ProfileSourceKey];

export function isProfileSourceKey(value: string): value is ProfileSourceKey {
  return value in PROFILE_SOURCE_TO_PROFILE_KEY;
}

/**
 * Translates a document's `missingProfileFields` (template source keys) into
 * profile system keys. Unknown values are dropped — a backend key the
 * frontend doesn't know yet must not crash the sheet — and duplicates removed.
 */
export function toMissingProfileKeys(
  sources: readonly string[],
): MissingProfileKey[] {
  const keys = new Set<MissingProfileKey>();
  for (const source of sources) {
    if (isProfileSourceKey(source)) {
      keys.add(PROFILE_SOURCE_TO_PROFILE_KEY[source]);
    }
  }
  return [...keys];
}

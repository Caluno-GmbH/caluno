/**
 * Maps requirement-form systemKeys to `users` column names (entity keys).
 * Email is account-owned (`users.email`) and is included in the read map only.
 */
export const SYSTEM_KEY_TO_USER_COLUMN = {
  firstname: 'firstname',
  lastname: 'lastname',
  'preferred-name': 'preferredName',
  gender: 'gender',
  email: 'email',
  phone: 'phone',
  street: 'street',
  zip: 'zip',
  city: 'city',
  birthdate: 'birthdate',
  iban: 'iban',
  'account-holder': 'accountHolder',
  bic: 'bic',
} as const;

export type ProfileSystemKey = keyof typeof SYSTEM_KEY_TO_USER_COLUMN;
export type ProfileUserColumn =
  (typeof SYSTEM_KEY_TO_USER_COLUMN)[ProfileSystemKey];

/** Writable profile columns — email is excluded (account-owned). */
export const WRITABLE_PROFILE_SYSTEM_KEYS = [
  'firstname',
  'lastname',
  'preferred-name',
  'gender',
  'phone',
  'street',
  'zip',
  'city',
  'birthdate',
  'iban',
  'account-holder',
  'bic',
] as const satisfies readonly ProfileSystemKey[];

export type WritableProfileSystemKey =
  (typeof WRITABLE_PROFILE_SYSTEM_KEYS)[number];

export type ProfileFields = {
  firstname?: string | null;
  lastname?: string | null;
  preferredName?: string | null;
  gender?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthdate?: string | null;
  iban?: string | null;
  accountHolder?: string | null;
  bic?: string | null;
  email?: string | null;
};

/** Build the systemKey → value map used by forms, documents, and UI. */
export function toProfileDataMap(user: ProfileFields): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [systemKey, column] of Object.entries(SYSTEM_KEY_TO_USER_COLUMN)) {
    const value = user[column as ProfileUserColumn];
    if (value !== undefined && value !== null && value !== '') {
      data[systemKey] = value;
    }
  }
  return data;
}

/**
 * Convert a systemKey → value map into a partial users-column update.
 * Skips email (account-owned) and unknown keys.
 */
export function profileDataToUserColumns(
  data: Record<string, unknown>,
): ProfileFields {
  const columns: ProfileFields = {};
  for (const key of WRITABLE_PROFILE_SYSTEM_KEYS) {
    if (!Object.hasOwn(data, key)) continue;
    const value = data[key];
    const column = SYSTEM_KEY_TO_USER_COLUMN[key];
    if (value === null || value === undefined) {
      columns[column] = null;
      continue;
    }
    if (typeof value === 'string') {
      columns[column] = value;
    }
  }
  return columns;
}

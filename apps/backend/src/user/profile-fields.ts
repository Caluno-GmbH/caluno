import { effectiveAccountHolder } from './user-name';

/** Writable profile columns — email is excluded (account-owned). */
export const WRITABLE_PROFILE_FIELD_KEYS = [
  'firstname',
  'lastname',
  'preferredName',
  'gender',
  'phone',
  'street',
  'zip',
  'city',
  'birthdate',
  'iban',
  'accountHolder',
  'bic',
] as const;

/**
 * Profile field keys — identical to `users` column / GraphQL names and to
 * requirement-form `profileKey`s. Email is account-owned (`users.email`) and is
 * included on reads only.
 */
export const PROFILE_FIELD_KEYS = [
  ...WRITABLE_PROFILE_FIELD_KEYS,
  'email',
] as const;

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

/**
 * Sparse profile bag for forms/documents: non-empty column values, with
 * `accountHolder` as the effective value (stored, else firstname + lastname).
 */
export function toProfileFields(user: ProfileFields): ProfileFields {
  const data: ProfileFields = {};
  for (const key of PROFILE_FIELD_KEYS) {
    if (key === 'accountHolder') continue;
    const value = user[key];
    if (value !== undefined && value !== null && value !== '') {
      data[key] = value;
    }
  }

  if (user.firstname && user.lastname) {
    data.accountHolder = effectiveAccountHolder({
      accountHolder: user.accountHolder,
      firstname: user.firstname,
      lastname: user.lastname,
    });
  } else {
    const stored = user.accountHolder;
    if (stored !== undefined && stored !== null && stored !== '') {
      data.accountHolder = stored;
    }
  }
  return data;
}

/**
 * Pick writable profile columns from a partial bag (e.g. form submit).
 * Skips email (account-owned) and unknown keys. Merge semantics: absent keys
 * are not invented.
 */
export function pickWritableProfileFields(
  data: Record<string, unknown>,
): ProfileFields {
  const columns: ProfileFields = {};
  for (const key of WRITABLE_PROFILE_FIELD_KEYS) {
    if (!Object.hasOwn(data, key)) continue;
    const value = data[key];
    if (value === null || value === undefined) {
      columns[key] = null;
      continue;
    }
    if (typeof value === 'string') {
      columns[key] = value;
    }
  }
  return columns;
}

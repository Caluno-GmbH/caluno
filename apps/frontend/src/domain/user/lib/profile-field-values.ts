import { SYSTEM_PROFILE_FIELDS } from '@/domain/requirement-form/system-profile-fields';

export type ProfileShape = {
  firstname?: string | null;
  lastname?: string | null;
  preferredName?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthdate?: string | null;
  iban?: string | null;
  accountHolder?: string | null;
  bic?: string | null;
};

/**
 * Sparse string bag of profile columns for form prefills / submission views.
 * Keys are the same as users columns / form systemKeys (no remapping).
 */
export function profileFieldValues(
  user: ProfileShape | null | undefined,
): Record<string, string> {
  if (!user) return {};
  const data: Record<string, string> = {};
  for (const { key } of SYSTEM_PROFILE_FIELDS) {
    const value = user[key as keyof ProfileShape];
    if (typeof value === 'string' && value.trim() !== '') {
      data[key] = value;
    }
  }
  return data;
}

/**
 * Every organisation is created with two internal roles whose names are written
 * into the database in English (`Owner`, `Member`) — see
 * `DEFAULT_OWNER_ROLE_NAME` / `DEFAULT_MEMBER_ROLE_NAME` in the backend. Because
 * they are stored data rather than message keys, they bypass i18n and reach a
 * German user untranslated.
 *
 * Mapping by name is safe: the backend refuses to rename or delete a role with
 * `isInternal`, so these two strings cannot drift. Roles an organisation defines
 * itself are returned as-is — they are the org's own words, not ours to translate.
 */
export type InternalRoleKey = 'internal.owner' | 'internal.member';

const INTERNAL_ROLE_KEYS: Record<string, InternalRoleKey> = {
  Owner: 'internal.owner',
  Member: 'internal.member',
};

export interface TranslatableRole {
  name: string;
  isInternal?: boolean | null;
}

/**
 * The `Role` message key for an internal role, or `null` when the role is
 * org-defined (or internal but unrecognised) and its stored name should be used.
 */
export function internalRoleKey(
  role: TranslatableRole,
): InternalRoleKey | null {
  if (!role.isInternal) return null;
  return INTERNAL_ROLE_KEYS[role.name] ?? null;
}

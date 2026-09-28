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

/**
 * Backend permission group keys (`organization`, `check-in`, …) and permission
 * keys (`ORG_VIEW`, `REQUIREMENT_PROFILE_EDIT`, …) reach us as stored strings,
 * not message keys. These helpers map them onto the camelCase `Role.permissions`
 * i18n keys so the card titles, row labels, and descriptions are translatable.
 */
function toCamelCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/** `Role.permissions` sub-key for a permission group's card title, from `group.key`. */
export function permissionTitleKey(groupKey: string): string {
  return `titles.${toCamelCase(groupKey)}`;
}

/** `Role.permissions` sub-key for a permission's row label, from `permission.key`. */
export function permissionLabelKey(permissionKey: string): string {
  return `labels.${toCamelCase(permissionKey)}`;
}

/** `Role.permissions` sub-key for a permission's description, from `permission.key`. */
export function permissionDescriptionKey(permissionKey: string): string {
  return `descriptions.${toCamelCase(permissionKey)}`;
}

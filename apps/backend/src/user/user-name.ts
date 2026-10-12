/**
 * User display name is always `firstname + " " + lastname`.
 * Better Auth `users.name` is dual-written to that value.
 */

import { isBlank, trimmed } from '../utils';

export function formatUserName(firstname: string, lastname: string): string {
  return `${firstname} ${lastname}`;
}

type AccountHolderSource = {
  accountHolder?: string | null;
  firstname: string;
  lastname: string;
};

/**
 * Effective account holder for display / documents / GraphQL when payment
 * fields are visible: stored value if set, else the derived user name.
 */
export function effectiveAccountHolder(user: AccountHolderSource): string {
  const stored = trimmed(user.accountHolder);
  if (!isBlank(stored)) return stored;
  return formatUserName(user.firstname, user.lastname);
}

/**
 * Persist rule: blank or equal to the derived name → null (follow name).
 * Any other non-blank string is an explicit lock.
 */
export function normalizeAccountHolderForStorage(
  accountHolder: string | null,
  name: string | null,
): string | null {
  const stored = trimmed(accountHolder);
  if (isBlank(stored)) return null;
  if (stored === name) return null;
  return stored;
}

/** Copy with `accountHolder` replaced by the effective value (authorized reads). */
export function withEffectiveAccountHolder<T extends AccountHolderSource>(
  user: T,
): T {
  return { ...user, accountHolder: effectiveAccountHolder(user) };
}

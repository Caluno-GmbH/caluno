/**
 * User display name is always `firstname + " " + lastname`.
 * Better Auth `users.name` is dual-written to that value.
 */

export function formatUserName(firstname: string, lastname: string): string {
  return `${firstname} ${lastname}`;
}

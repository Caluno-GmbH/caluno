import type { TranslatableRole } from '@/domain/role/lib/role-label';

export interface SearchableVolunteer {
  user: { name: string; email: string };
  roles: TranslatableRole[];
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function matchesVolunteerQuery(
  volunteer: SearchableVolunteer,
  query: string,
  roleLabel: (role: TranslatableRole) => string,
): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;

  return [
    volunteer.user.name,
    volunteer.user.email,
    ...volunteer.roles.map(roleLabel),
    ...volunteer.roles.map((role) => role.name),
  ].some((field) => fold(field).includes(needle));
}

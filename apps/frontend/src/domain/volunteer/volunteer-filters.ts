export const UNSET = '__unset__';

export type GenderOption = { value: string; label: string };

export type VolunteerFilters = {
  roleIds: string[];
  gender: string | null;
  city: string | null;
  verified: 'all' | 'verified' | 'unverified';
};

type FilterableMembership = {
  user: {
    gender: string | null;
    city: string | null;
  };
  roles: Array<{ id: string }>;
  idVerifiedAt: string | null;
};

export function matchesVolunteerFilters(
  membership: FilterableMembership,
  filters: VolunteerFilters,
): boolean {
  if (filters.roleIds.length > 0) {
    const memberRoleIds = new Set(membership.roles.map((r) => r.id));
    if (!filters.roleIds.some((id) => memberRoleIds.has(id))) return false;
  }

  if (filters.gender !== null) {
    const g = membership.user.gender;
    if (filters.gender === UNSET) {
      if (g !== null && g !== '') return false;
    } else {
      if (g !== filters.gender) return false;
    }
  }

  if (filters.city !== null) {
    const c = membership.user.city;
    if (filters.city === UNSET) {
      if (c !== null && c !== '') return false;
    } else {
      if (c !== filters.city) return false;
    }
  }

  if (filters.verified !== 'all') {
    if (filters.verified === 'verified' && !membership.idVerifiedAt)
      return false;
    if (filters.verified === 'unverified' && membership.idVerifiedAt)
      return false;
  }

  return true;
}

type WithGender = { user: { gender: string | null } };
type WithCity = { user: { city: string | null } };

export function deriveGenderOptions(memberships: WithGender[]): GenderOption[] {
  const values = new Set<string>();
  let hasUnset = false;

  for (const m of memberships) {
    const g = m.user.gender;
    if (g === null || g === '') {
      hasUnset = true;
    } else {
      values.add(g);
    }
  }

  const opts: GenderOption[] = [...values]
    .sort()
    .map((v) => ({ label: v, value: v }));

  if (hasUnset) opts.push({ label: UNSET, value: UNSET });

  return opts;
}

type WithEmail = { user: { email: string | null | undefined } };

export function collectVolunteerEmails(rows: WithEmail[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const email = row.user.email;
    if (email && email.trim() !== '') {
      seen.add(email);
    }
  }
  return [...seen];
}

export function deriveCityOptions(memberships: WithCity[]): string[] {
  const values = new Set<string>();
  let hasUnset = false;

  for (const m of memberships) {
    const c = m.user.city;
    if (c === null || c === '') {
      hasUnset = true;
    } else {
      values.add(c);
    }
  }

  const result = [...values].sort();
  if (hasUnset) result.push(UNSET);

  return result;
}

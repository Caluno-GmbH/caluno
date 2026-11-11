import { describe, expect, it } from 'bun:test';
import {
  collectVolunteerEmails,
  deriveCityOptions,
  deriveGenderOptions,
  matchesVolunteerFilters,
  UNSET,
} from './volunteer-filters';
import { matchesVolunteerQuery } from './volunteer-search';

type Role = { id: string; name: string; isInternal: boolean };
type FilterableMembership = {
  user: {
    name: string;
    email: string;
    gender: string | null;
    city: string | null;
    idVerifiedAt: string | null;
  };
  roles: Role[];
  idVerifiedAt: string | null;
};

const roleLabel = (role: { name: string }) => role.name;

function membership(
  overrides: Partial<FilterableMembership> = {},
): FilterableMembership {
  return {
    user: {
      name: 'Anna Schmidt',
      email: 'anna@example.org',
      gender: 'female',
      city: 'Hamburg',
      idVerifiedAt: null,
    },
    roles: [],
    idVerifiedAt: null,
    ...overrides,
  };
}

const neutralFilters = {
  roleIds: [],
  gender: null,
  city: null,
  verified: 'all' as const,
};

describe('collectVolunteerEmails', () => {
  it('returns empty array for empty input', () => {
    expect(collectVolunteerEmails([])).toEqual([]);
  });

  it('returns deduped emails from a filtered subset', () => {
    const rows = [
      { user: { email: 'alice@example.org' } },
      { user: { email: 'bob@example.org' } },
      { user: { email: 'alice@example.org' } },
    ];
    const result = collectVolunteerEmails(rows);
    expect(result).toHaveLength(2);
    expect(result).toContain('alice@example.org');
    expect(result).toContain('bob@example.org');
  });

  it('skips null and empty email values', () => {
    const rows = [
      { user: { email: null } },
      { user: { email: '' } },
      { user: { email: 'valid@example.org' } },
    ];
    expect(collectVolunteerEmails(rows)).toEqual(['valid@example.org']);
  });
});

describe('matchesVolunteerFilters', () => {
  it('passes all-neutral filters', () => {
    expect(matchesVolunteerFilters(membership(), neutralFilters)).toBe(true);
  });

  it('filters by role id (any of selected)', () => {
    const m = membership({
      roles: [{ id: 'r1', name: 'Guide', isInternal: false }],
    });
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, roleIds: ['r1'] }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, roleIds: ['r2'] }),
    ).toBe(false);
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, roleIds: ['r1', 'r2'] }),
    ).toBe(true);
  });

  it('filters by gender exact match', () => {
    const m = membership({
      user: {
        name: 'A',
        email: 'a@a.com',
        gender: 'female',
        city: null,
        idVerifiedAt: null,
      },
    });
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, gender: 'female' }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, gender: 'male' }),
    ).toBe(false);
  });

  it('UNSET gender matches rows with null/empty gender', () => {
    const noGender = membership({
      user: {
        name: 'B',
        email: 'b@b.com',
        gender: null,
        city: null,
        idVerifiedAt: null,
      },
    });
    const emptyGender = membership({
      user: {
        name: 'C',
        email: 'c@c.com',
        gender: '',
        city: null,
        idVerifiedAt: null,
      },
    });
    const withGender = membership({
      user: {
        name: 'D',
        email: 'd@d.com',
        gender: 'male',
        city: null,
        idVerifiedAt: null,
      },
    });
    expect(
      matchesVolunteerFilters(noGender, { ...neutralFilters, gender: UNSET }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(emptyGender, {
        ...neutralFilters,
        gender: UNSET,
      }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(withGender, { ...neutralFilters, gender: UNSET }),
    ).toBe(false);
  });

  it('filters by city exact match', () => {
    const m = membership({
      user: {
        name: 'A',
        email: 'a@a.com',
        gender: null,
        city: 'Berlin',
        idVerifiedAt: null,
      },
    });
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, city: 'Berlin' }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(m, { ...neutralFilters, city: 'Hamburg' }),
    ).toBe(false);
  });

  it('UNSET city matches rows with null/empty city', () => {
    const noCity = membership({
      user: {
        name: 'A',
        email: 'a@a.com',
        gender: null,
        city: null,
        idVerifiedAt: null,
      },
    });
    const withCity = membership({
      user: {
        name: 'B',
        email: 'b@b.com',
        gender: null,
        city: 'Munich',
        idVerifiedAt: null,
      },
    });
    expect(
      matchesVolunteerFilters(noCity, { ...neutralFilters, city: UNSET }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(withCity, { ...neutralFilters, city: UNSET }),
    ).toBe(false);
  });

  it('filters verified rows', () => {
    const verified = membership({ idVerifiedAt: '2026-01-01' });
    const unverified = membership({ idVerifiedAt: null });
    expect(
      matchesVolunteerFilters(verified, {
        ...neutralFilters,
        verified: 'verified',
      }),
    ).toBe(true);
    expect(
      matchesVolunteerFilters(unverified, {
        ...neutralFilters,
        verified: 'verified',
      }),
    ).toBe(false);
    expect(
      matchesVolunteerFilters(verified, {
        ...neutralFilters,
        verified: 'unverified',
      }),
    ).toBe(false);
    expect(
      matchesVolunteerFilters(unverified, {
        ...neutralFilters,
        verified: 'unverified',
      }),
    ).toBe(true);
  });

  it('AND semantics: role filter + search query narrows to intersection', () => {
    const anna = membership({
      user: {
        name: 'Anna Schmidt',
        email: 'anna@example.org',
        gender: null,
        city: null,
        idVerifiedAt: null,
      },
      roles: [{ id: 'r1', name: 'Guide', isInternal: false }],
    });
    const bob = membership({
      user: {
        name: 'Bob Müller',
        email: 'bob@example.org',
        gender: null,
        city: null,
        idVerifiedAt: null,
      },
      roles: [{ id: 'r2', name: 'Cook', isInternal: false }],
    });
    const all = [anna, bob];

    const withRole = { ...neutralFilters, roleIds: ['r1'] };
    const filtered = all.filter((m) => matchesVolunteerFilters(m, withRole));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe(anna);

    // Adding search query on top further narrows
    const searchFiltered = filtered.filter((m) =>
      matchesVolunteerQuery(m, 'anna', roleLabel),
    );
    expect(searchFiltered).toHaveLength(1);

    // Clearing role filter: search result is preserved
    const noRoleFiltered = all.filter(
      (m) =>
        matchesVolunteerFilters(m, neutralFilters) &&
        matchesVolunteerQuery(m, 'anna', roleLabel),
    );
    expect(noRoleFiltered).toHaveLength(1);
    expect(noRoleFiltered[0]).toBe(anna);
  });
});

describe('deriveGenderOptions', () => {
  it('returns distinct sorted values, no empty strings', () => {
    const memberships = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: 'female',
          city: null,
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'B',
          email: 'b@b.com',
          gender: 'male',
          city: null,
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'C',
          email: 'c@c.com',
          gender: 'female',
          city: null,
          idVerifiedAt: null,
        },
      }),
    ];
    const opts = deriveGenderOptions(memberships);
    expect(opts.map((o) => o.value)).toEqual(['female', 'male']);
  });

  it('appends UNSET option only when some row lacks gender', () => {
    const withNull = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: 'female',
          city: null,
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'B',
          email: 'b@b.com',
          gender: null,
          city: null,
          idVerifiedAt: null,
        },
      }),
    ];
    const opts = deriveGenderOptions(withNull);
    expect(opts[opts.length - 1]?.value).toBe(UNSET);

    const withoutNull = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: 'female',
          city: null,
          idVerifiedAt: null,
        },
      }),
    ];
    const opts2 = deriveGenderOptions(withoutNull);
    expect(opts2.every((o) => o.value !== UNSET)).toBe(true);
  });

  it('omits empty string values', () => {
    const memberships = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: '',
          city: null,
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'B',
          email: 'b@b.com',
          gender: 'male',
          city: null,
          idVerifiedAt: null,
        },
      }),
    ];
    const opts = deriveGenderOptions(memberships);
    // '' is treated as not-set, so UNSET bucket appears but '' is not a normal option
    expect(opts.map((o) => o.value)).not.toContain('');
    expect(opts[opts.length - 1]?.value).toBe(UNSET);
  });
});

describe('deriveCityOptions', () => {
  it('returns distinct sorted values, with UNSET when some row lacks city', () => {
    const memberships = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: null,
          city: 'Hamburg',
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'B',
          email: 'b@b.com',
          gender: null,
          city: 'Berlin',
          idVerifiedAt: null,
        },
      }),
      membership({
        user: {
          name: 'C',
          email: 'c@c.com',
          gender: null,
          city: null,
          idVerifiedAt: null,
        },
      }),
    ];
    expect(deriveCityOptions(memberships)).toEqual([
      'Berlin',
      'Hamburg',
      UNSET,
    ]);
  });

  it('no UNSET when all rows have a city', () => {
    const memberships = [
      membership({
        user: {
          name: 'A',
          email: 'a@a.com',
          gender: null,
          city: 'Munich',
          idVerifiedAt: null,
        },
      }),
    ];
    expect(deriveCityOptions(memberships)).toEqual(['Munich']);
  });
});

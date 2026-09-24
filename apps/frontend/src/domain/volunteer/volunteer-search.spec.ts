import { describe, expect, it } from 'bun:test';
import { matchesVolunteerQuery } from './volunteer-search';

const roleLabel = (role: { name: string }) =>
  role.name === 'Member' ? 'Mitglied' : role.name;

describe('matchesVolunteerQuery', () => {
  it('matches a name case-insensitively', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [],
    };
    expect(matchesVolunteerQuery(volunteer, 'schmidt', roleLabel)).toBe(true);
  });

  it('matches an email substring', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [],
    };
    expect(matchesVolunteerQuery(volunteer, 'example.org', roleLabel)).toBe(
      true,
    );
  });

  it('matches a translated internal role label', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [{ name: 'Member', isInternal: true }],
    };
    expect(matchesVolunteerQuery(volunteer, 'Mitglied', roleLabel)).toBe(true);
  });

  it('matches a raw stored role name', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [{ name: 'Member', isInternal: true }],
    };
    expect(matchesVolunteerQuery(volunteer, 'Member', roleLabel)).toBe(true);
  });

  it('matches a custom org-defined role by its stored name', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [{ name: 'Stage Crew', isInternal: false }],
    };
    expect(matchesVolunteerQuery(volunteer, 'Stage Crew', roleLabel)).toBe(
      true,
    );
  });

  it('folds diacritics both ways', () => {
    const mueller = {
      user: { name: 'Müller', email: 'mueller@example.org' },
      roles: [],
    };
    const muller = {
      user: { name: 'Muller', email: 'muller@example.org' },
      roles: [],
    };
    expect(matchesVolunteerQuery(mueller, 'muller', roleLabel)).toBe(true);
    expect(matchesVolunteerQuery(muller, 'Müller', roleLabel)).toBe(true);
  });

  it('matches everything for an empty or whitespace-only query', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [],
    };
    expect(matchesVolunteerQuery(volunteer, '', roleLabel)).toBe(true);
    expect(matchesVolunteerQuery(volunteer, '   ', roleLabel)).toBe(true);
  });

  it('returns false for a query matching nothing', () => {
    const volunteer = {
      user: { name: 'Anna Schmidt', email: 'anna@example.org' },
      roles: [{ name: 'Member', isInternal: true }],
    };
    expect(matchesVolunteerQuery(volunteer, 'zzzzz', roleLabel)).toBe(false);
  });
});

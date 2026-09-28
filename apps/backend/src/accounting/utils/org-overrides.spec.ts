import { describe, expect, it } from 'bun:test';
import { applyOrgOverrides } from './org-overrides';

const orgValues = {
  org_name: 'Lesepaten Nord',
  org_street: 'Museumstraße 23',
  org_zip: '22765',
  org_city: 'Hamburg',
};

describe('applyOrgOverrides', () => {
  it('Leaves the organisation’s own values alone when nothing is overridden', () => {
    expect(applyOrgOverrides(orgValues, undefined)).toEqual({
      ...orgValues,
      org_facility_name: 'Lesepaten Nord',
    });
  });

  it('States the body the coordinator named instead', () => {
    const resolved = applyOrgOverrides(orgValues, {
      org_name: 'Trägerverein Hamburg e.V.',
      org_street: 'Hauptstraße 1',
    });

    expect(resolved.org_name).toBe('Trägerverein Hamburg e.V.');
    expect(resolved.org_street).toBe('Hauptstraße 1');
    // Untouched sources keep coming from the organisation.
    expect(resolved.org_city).toBe('Hamburg');
  });

  it('Falls back when an override is cleared, which is how one is undone', () => {
    const resolved = applyOrgOverrides(orgValues, {
      org_name: '',
      org_street: '   ',
    });

    expect(resolved.org_name).toBe('Lesepaten Nord');
    expect(resolved.org_street).toBe('Museumstraße 23');
  });

  it('Defaults the facility to the organisation, and lets it differ', () => {
    expect(applyOrgOverrides(orgValues, {}).org_facility_name).toBe(
      'Lesepaten Nord',
    );

    const resolved = applyOrgOverrides(orgValues, {
      org_name: 'Trägerverein Hamburg e.V.',
      org_facility_name: 'Stadtteilbücherei Altona',
    });

    // Who signs and where the volunteer serves are separate answers.
    expect(resolved.org_name).toBe('Trägerverein Hamburg e.V.');
    expect(resolved.org_facility_name).toBe('Stadtteilbücherei Altona');
  });

  it('Follows the organisation name when only the name is overridden', () => {
    const resolved = applyOrgOverrides(orgValues, {
      org_name: 'Trägerverein Hamburg e.V.',
    });

    expect(resolved.org_facility_name).toBe('Lesepaten Nord');
  });
});

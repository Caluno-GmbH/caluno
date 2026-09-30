import { describe, expect, it } from 'bun:test';
import { getOrgUnitDisplayName } from '../org-display-name';

describe('getOrgUnitDisplayName', () => {
  it('returns the unit name for root units', () => {
    expect(
      getOrgUnitDisplayName({
        name: 'Playground',
        isRoot: true,
        rootOrganizationName: undefined,
      }),
    ).toBe('Playground');
  });

  it('returns "RootOrg › Unit" for nested units', () => {
    expect(
      getOrgUnitDisplayName({
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: 'Playground',
      }),
    ).toBe('Playground › Sales');
  });

  it('returns the unit name when rootOrganizationName is missing', () => {
    expect(
      getOrgUnitDisplayName({
        name: 'Sales',
        isRoot: false,
        rootOrganizationName: undefined,
      }),
    ).toBe('Sales');
  });

  it('prefers isRoot over a present rootOrganizationName', () => {
    expect(
      getOrgUnitDisplayName({
        name: 'Playground',
        isRoot: true,
        rootOrganizationName: 'Playground',
      }),
    ).toBe('Playground');
  });
});

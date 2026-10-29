import { describe, expect, it } from 'bun:test';
import { formatAddress, resolveTimeEntryLocation } from './location';

describe('formatAddress', () => {
  it('joins all present parts', () => {
    expect(
      formatAddress({ street: 'Hauptstr. 1', zipCode: '20095', city: 'Hamburg' }),
    ).toBe('Hauptstr. 1, 20095, Hamburg');
  });

  it('skips null/empty parts', () => {
    expect(
      formatAddress({ street: 'Hauptstr. 1', zipCode: null, city: 'Hamburg' }),
    ).toBe('Hauptstr. 1, Hamburg');
  });

  it('returns null when all parts are absent', () => {
    expect(formatAddress({ street: null, zipCode: null, city: null })).toBeNull();
  });

  it('returns null when all parts are undefined', () => {
    expect(formatAddress({ street: undefined, zipCode: undefined, city: undefined })).toBeNull();
  });
});

describe('resolveTimeEntryLocation', () => {
  const baseOrgUnit = {
    id: 'ou1',
    name: 'Unit',
    street: 'Str 1',
    zipCode: '20095',
    city: 'HH',
    organization: { id: 'o1', name: 'Org' },
  };

  it('returns overrideLocation when shiftInstance has one', () => {
    const entry = {
      shiftInstance: { overrideLocation: 'Hall A', master: { location: 'Hall B' } },
      organizationUnit: baseOrgUnit,
    } as any;
    expect(resolveTimeEntryLocation(entry)).toBe('Hall A');
  });

  it('falls back to master.location when no override', () => {
    const entry = {
      shiftInstance: { overrideLocation: null, master: { location: 'Hall B' } },
      organizationUnit: baseOrgUnit,
    } as any;
    expect(resolveTimeEntryLocation(entry)).toBe('Hall B');
  });

  it('falls back to org unit address when no shiftInstance', () => {
    const entry = {
      shiftInstance: null,
      organizationUnit: baseOrgUnit,
    } as any;
    expect(resolveTimeEntryLocation(entry)).toBe('Str 1, 20095, HH');
  });

  it('returns null when no shift and org unit address is empty', () => {
    const entry = {
      shiftInstance: null,
      organizationUnit: { ...baseOrgUnit, street: null, zipCode: null, city: null },
    } as any;
    expect(resolveTimeEntryLocation(entry)).toBeNull();
  });

  it('returns null when master.location is also null and no override', () => {
    const entry = {
      shiftInstance: { overrideLocation: null, master: { location: null } },
      organizationUnit: baseOrgUnit,
    } as any;
    expect(resolveTimeEntryLocation(entry)).toBeNull();
  });
});

import { describe, expect, it } from 'bun:test';
import { resolveTimeEntryLocation, sumDurationMinutes } from './location';

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
      shiftInstance: {
        overrideLocation: 'Hall A',
        master: { location: 'Hall B' },
      },
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
    expect(resolveTimeEntryLocation(entry)).toBe('Str 1, 20095 HH');
  });

  it('returns null when no shift and org unit address is empty', () => {
    const entry = {
      shiftInstance: null,
      organizationUnit: {
        ...baseOrgUnit,
        street: null,
        zipCode: null,
        city: null,
      },
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

describe('sumDurationMinutes', () => {
  it('sums duration of closed entries', () => {
    const entries = [
      { startedAt: '2024-01-01T08:00:00Z', endedAt: '2024-01-01T10:00:00Z' }, // 120 min
      { startedAt: '2024-01-01T12:00:00Z', endedAt: '2024-01-01T13:30:00Z' }, // 90 min
    ];
    expect(sumDurationMinutes(entries)).toBe(210);
  });

  it('contributes 0 for open entries', () => {
    const entries = [{ startedAt: '2024-01-01T08:00:00Z', endedAt: null }];
    expect(sumDurationMinutes(entries)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(sumDurationMinutes([])).toBe(0);
  });

  it('contributes 0 for undefined endedAt', () => {
    const entries = [{ startedAt: '2024-01-01T08:00:00Z', endedAt: undefined }];
    expect(sumDurationMinutes(entries)).toBe(0);
  });
});

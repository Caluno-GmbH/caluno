import { describe, expect, it } from 'bun:test';
import { ReimbursementTypeKey } from '@repo/data';
import { resolvePauschaleMarker } from './pauschale-marker';

const types = [
  { key: ReimbursementTypeKey.Ehrenamt },
  { key: ReimbursementTypeKey.Uebungsleiter },
];

describe('resolvePauschaleMarker', () => {
  it('returns null for an unpaid shift (no reimbursement type id)', () => {
    expect(resolvePauschaleMarker(null, types)).toBeNull();
    expect(resolvePauschaleMarker(undefined, types)).toBeNull();
    expect(
      resolvePauschaleMarker('' as ReimbursementTypeKey, types),
    ).toBeNull();
  });

  it('returns null while reimbursement types are still loading', () => {
    expect(
      resolvePauschaleMarker(ReimbursementTypeKey.Ehrenamt, undefined),
    ).toBeNull();
    expect(
      resolvePauschaleMarker(ReimbursementTypeKey.Ehrenamt, null),
    ).toBeNull();
  });

  it('returns null when the id does not match a known type', () => {
    expect(
      resolvePauschaleMarker('UNKNOWN' as ReimbursementTypeKey, types),
    ).toBeNull();
  });

  it('resolves the Ehrenamtspauschale marker', () => {
    expect(resolvePauschaleMarker(ReimbursementTypeKey.Ehrenamt, types)).toBe(
      'ehrenamt',
    );
  });

  it('resolves the Übungsleiterpauschale marker', () => {
    expect(
      resolvePauschaleMarker(ReimbursementTypeKey.Uebungsleiter, types),
    ).toBe('uebungsleiter');
  });
});

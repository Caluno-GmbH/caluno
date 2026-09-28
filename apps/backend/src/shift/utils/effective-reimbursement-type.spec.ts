import { describe, expect, it } from 'bun:test';
import { resolveEffectiveReimbursementTypeId } from './effective-reimbursement-type';

describe('resolveEffectiveReimbursementTypeId', () => {
  it('prefers an explicit occurrence override over the master type', () => {
    expect(resolveEffectiveReimbursementTypeId('override', 'master')).toBe(
      'override',
    );
  });

  it('falls back to the master type when the occurrence has no override', () => {
    expect(resolveEffectiveReimbursementTypeId(null, 'master')).toBe('master');
    expect(resolveEffectiveReimbursementTypeId(undefined, 'master')).toBe(
      'master',
    );
  });

  it('returns null when neither the override nor the master type is set', () => {
    expect(resolveEffectiveReimbursementTypeId(null, null)).toBeNull();
    expect(
      resolveEffectiveReimbursementTypeId(undefined, undefined),
    ).toBeNull();
  });
});

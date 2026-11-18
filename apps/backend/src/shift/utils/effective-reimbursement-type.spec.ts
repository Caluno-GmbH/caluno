import { describe, expect, it } from 'bun:test';
import { ReimbursementTypeKey } from '../../accounting/enums';
import { resolveEffectiveReimbursementTypeKey } from './effective-reimbursement-type';

describe('resolveEffectiveReimbursementTypeKey', () => {
  it('prefers an explicit occurrence override over the master type', () => {
    expect(
      resolveEffectiveReimbursementTypeKey(
        ReimbursementTypeKey.UEBUNGSLEITER,
        ReimbursementTypeKey.EHRENAMT,
      ),
    ).toBe(ReimbursementTypeKey.UEBUNGSLEITER);
  });

  it('falls back to the master type when the occurrence has no override', () => {
    expect(
      resolveEffectiveReimbursementTypeKey(null, ReimbursementTypeKey.EHRENAMT),
    ).toBe(ReimbursementTypeKey.EHRENAMT);
    expect(
      resolveEffectiveReimbursementTypeKey(
        undefined,
        ReimbursementTypeKey.EHRENAMT,
      ),
    ).toBe(ReimbursementTypeKey.EHRENAMT);
  });

  it('returns null when neither the override nor the master type is set', () => {
    expect(resolveEffectiveReimbursementTypeKey(null, null)).toBeNull();
    expect(
      resolveEffectiveReimbursementTypeKey(undefined, undefined),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'bun:test';
import { ReimbursementTypeKey } from '../../accounting/enums';
import { resolveEffectiveReimbursementTypeId } from './effective-reimbursement-type';

describe('resolveEffectiveReimbursementTypeId', () => {
  it('prefers an explicit occurrence override over the master type', () => {
    expect(
      resolveEffectiveReimbursementTypeId(
        ReimbursementTypeKey.UEBUNGSLEITER,
        ReimbursementTypeKey.EHRENAMT,
      ),
    ).toBe(ReimbursementTypeKey.UEBUNGSLEITER);
  });

  it('falls back to the master type when the occurrence has no override', () => {
    expect(
      resolveEffectiveReimbursementTypeId(null, ReimbursementTypeKey.EHRENAMT),
    ).toBe(ReimbursementTypeKey.EHRENAMT);
    expect(
      resolveEffectiveReimbursementTypeId(
        undefined,
        ReimbursementTypeKey.EHRENAMT,
      ),
    ).toBe(ReimbursementTypeKey.EHRENAMT);
  });

  it('returns null when neither the override nor the master type is set', () => {
    expect(resolveEffectiveReimbursementTypeId(null, null)).toBeNull();
    expect(
      resolveEffectiveReimbursementTypeId(undefined, undefined),
    ).toBeNull();
  });
});

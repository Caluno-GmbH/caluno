import { describe, expect, it } from 'bun:test';
import {
  requiresInviteConfirmation,
  toAllowanceDisplay,
} from './allowance-display';

describe('requiresInviteConfirmation', () => {
  it('requires confirmation only for WOULD_EXCEED', () => {
    expect(requiresInviteConfirmation('WOULD_EXCEED')).toBe(true);
    expect(requiresInviteConfirmation('ELIGIBLE')).toBe(false);
    expect(requiresInviteConfirmation('NEARLY_EXHAUSTED')).toBe(false);
    expect(requiresInviteConfirmation('NO_AGREEMENT')).toBe(false);
    expect(requiresInviteConfirmation(null)).toBe(false);
    expect(requiresInviteConfirmation(undefined)).toBe(false);
  });
});

describe('toAllowanceDisplay', () => {
  it('maps each state to a distinct label key and tone, never color-only', () => {
    const eligible = toAllowanceDisplay('ELIGIBLE');
    const nearlyExhausted = toAllowanceDisplay('NEARLY_EXHAUSTED');
    const wouldExceed = toAllowanceDisplay('WOULD_EXCEED');
    const noAgreement = toAllowanceDisplay('NO_AGREEMENT');

    const labelKeys = [
      eligible.labelKey,
      nearlyExhausted.labelKey,
      wouldExceed.labelKey,
      noAgreement.labelKey,
    ];
    expect(new Set(labelKeys).size).toBe(4);

    expect(eligible.tone).toBe('positive');
    expect(wouldExceed.tone).toBe('warning');
    expect(nearlyExhausted.tone).toBe('caution');
    expect(noAgreement.tone).toBe('caution');
  });
});

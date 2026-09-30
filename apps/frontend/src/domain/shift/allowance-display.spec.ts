import { describe, expect, it } from 'bun:test';
import { requiresInviteConfirmation } from './allowance-display';

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

/**
 * Per-volunteer allowance status (VOLI-1248), shown in the invite list, the
 * shift instance volunteer table and the volunteer profile panel. Mirrors the
 * backend `VolunteerAllowanceState` GraphQL enum. Status signals only — no
 * surface renders a euro amount, balance, or rate for any role.
 */
export type VolunteerAllowanceState =
  | 'ELIGIBLE'
  | 'NEARLY_EXHAUSTED'
  | 'WOULD_EXCEED'
  | 'NO_AGREEMENT';

/**
 * Only "would exceed" needs an explicit confirmation before inviting —
 * "nearly exhausted" is informational and does not block or gate the invite.
 */
export function requiresInviteConfirmation(
  state: VolunteerAllowanceState | null | undefined,
): boolean {
  return state === 'WOULD_EXCEED';
}

export type AllowanceDisplayTone = 'positive' | 'caution' | 'warning';

export type AllowanceDisplay = {
  /** i18n key under `Shift.transferList.allowance`. */
  labelKey: 'eligible' | 'nearlyExhausted' | 'wouldExceed' | 'noAgreement';
  /** Never color-only: paired with a distinct label (and icon in the UI). */
  tone: AllowanceDisplayTone;
};

const ALLOWANCE_DISPLAY: Record<VolunteerAllowanceState, AllowanceDisplay> = {
  ELIGIBLE: { labelKey: 'eligible', tone: 'positive' },
  NEARLY_EXHAUSTED: { labelKey: 'nearlyExhausted', tone: 'caution' },
  WOULD_EXCEED: { labelKey: 'wouldExceed', tone: 'warning' },
  NO_AGREEMENT: { labelKey: 'noAgreement', tone: 'caution' },
};

export function toAllowanceDisplay(
  state: VolunteerAllowanceState,
): AllowanceDisplay {
  return ALLOWANCE_DISPLAY[state];
}

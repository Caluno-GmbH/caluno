import type { VolunteerAllowanceState as GeneratedVolunteerAllowanceState } from '@repo/data';

/**
 * Per-volunteer allowance status (VOLI-1248), shown in the invite list, the
 * shift instance volunteer table and the volunteer profile panel. Mirrors the
 * backend `VolunteerAllowanceState` GraphQL enum. Status signals only — no
 * surface renders a euro amount, balance, or rate for any role.
 */
export type VolunteerAllowanceState = `${GeneratedVolunteerAllowanceState}`;

/**
 * Only "would exceed" needs an explicit confirmation before inviting —
 * "nearly exhausted" is informational and does not block or gate the invite.
 */
export function requiresInviteConfirmation(
  state: VolunteerAllowanceState | null | undefined,
): boolean {
  return state === 'WOULD_EXCEED';
}

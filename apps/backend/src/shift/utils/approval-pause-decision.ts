import type { Weekday } from '../../shared/enums/weekday.enum';

export interface ApprovalPauseInput {
  joinRequiresApproval: boolean;
  automationEnabled: boolean;
  activeDays: readonly Weekday[];
  leadTimeHours: number | null;
  shiftWeekday: Weekday;
  hoursUntilStart: number;
  minVolunteers: number | null;
  filledCount: number;
}

/**
 * Whether a sign-up skips admin approval because the shift is understaffed
 * inside the org unit's pause-approval window. Staffing is read fresh on every
 * sign-up, so approval applies again by itself once the shift is back at its
 * minimum — there is no state to re-arm.
 */
export function isApprovalPaused(input: ApprovalPauseInput): boolean {
  if (!input.joinRequiresApproval) return false;
  if (!input.automationEnabled) return false;
  if (input.leadTimeHours == null) return false;
  if (input.minVolunteers == null) return false;
  if (!input.activeDays.includes(input.shiftWeekday)) return false;
  if (input.hoursUntilStart > input.leadTimeHours) return false;

  return input.filledCount < input.minVolunteers;
}

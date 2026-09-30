import type { Weekday } from '../../shared/enums/weekday.enum';

export const DISCOVERY_EMAIL_CATCH_UP_HOURS = 6;

export interface DiscoveryEmailScheduleInput {
  enabled: boolean;
  activeDays: readonly Weekday[];
  sendAtTime: string | null;
  nowWeekday: Weekday;
  nowHourMinute: string;
}

function toMinutes(hourMinute: string): number | null {
  const [hours, minutes] = hourMinute.split(':');
  const parsed = Number(hours) * 60 + Number(minutes);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isDiscoveryEmailDue(
  input: DiscoveryEmailScheduleInput,
): boolean {
  if (!input.enabled) return false;
  if (input.sendAtTime == null) return false;
  if (!input.activeDays.includes(input.nowWeekday)) return false;

  const scheduled = toMinutes(input.sendAtTime);
  const now = toMinutes(input.nowHourMinute);
  if (scheduled == null || now == null) return false;

  const minutesLate = now - scheduled;

  return minutesLate >= 0 && minutesLate <= DISCOVERY_EMAIL_CATCH_UP_HOURS * 60;
}

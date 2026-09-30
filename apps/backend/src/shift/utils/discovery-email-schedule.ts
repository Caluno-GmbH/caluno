import type { Weekday } from '../../shared/enums/weekday.enum';

export interface DiscoveryEmailScheduleInput {
  enabled: boolean;
  activeDays: readonly Weekday[];
  sendAtTime: string | null;
  nowWeekday: Weekday;
  nowHourMinute: string;
}

export function isDiscoveryEmailDue(
  input: DiscoveryEmailScheduleInput,
): boolean {
  if (!input.enabled) return false;
  if (input.sendAtTime == null) return false;
  if (!input.activeDays.includes(input.nowWeekday)) return false;

  return input.sendAtTime === input.nowHourMinute;
}

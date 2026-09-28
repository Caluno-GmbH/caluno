import { registerEnumType } from '@nestjs/graphql';

export enum Weekday {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

registerEnumType(Weekday, {
  name: 'Weekday',
});

export const ALL_WEEKDAYS: readonly Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

export const WEEKEND_WEEKDAYS: readonly Weekday[] = [
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

export function weekdayFromIsoDay(isoDay: number): Weekday {
  const weekday = ALL_WEEKDAYS[isoDay - 1];
  if (!weekday) {
    throw new Error(`Invalid ISO weekday: ${isoDay}`);
  }
  return weekday;
}

export function sortWeekdays(days: readonly Weekday[]): Weekday[] {
  return ALL_WEEKDAYS.filter((day) => days.includes(day));
}

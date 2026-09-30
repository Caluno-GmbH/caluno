import { describe, expect, it } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import { appHourMinute, appWeekday } from './app-time';
import {
  type DiscoveryEmailScheduleInput,
  isDiscoveryEmailDue,
} from './discovery-email-schedule';

function input(
  overrides: Partial<DiscoveryEmailScheduleInput> = {},
): DiscoveryEmailScheduleInput {
  return {
    enabled: true,
    activeDays: [Weekday.SUNDAY],
    sendAtTime: '08:00',
    nowWeekday: Weekday.SUNDAY,
    nowHourMinute: '08:00',
    ...overrides,
  };
}

describe('isDiscoveryEmailDue', () => {
  it('is due on an active day at the chosen time', () => {
    expect(isDiscoveryEmailDue(input())).toBe(true);
  });

  it('is never due while the automation is off', () => {
    expect(isDiscoveryEmailDue(input({ enabled: false }))).toBe(false);
  });

  it('is not due on a day the coordinator did not select', () => {
    expect(isDiscoveryEmailDue(input({ nowWeekday: Weekday.MONDAY }))).toBe(
      false,
    );
  });

  it('is not due at any other time of day', () => {
    expect(isDiscoveryEmailDue(input({ nowHourMinute: '07:45' }))).toBe(false);
    expect(isDiscoveryEmailDue(input({ nowHourMinute: '08:15' }))).toBe(false);
  });

  it('is not due when no send time is configured', () => {
    expect(isDiscoveryEmailDue(input({ sendAtTime: null }))).toBe(false);
  });

  it('is not due when every day has been cleared', () => {
    expect(isDiscoveryEmailDue(input({ activeDays: [] }))).toBe(false);
  });

  it('supports several send days', () => {
    const settings = {
      activeDays: [Weekday.WEDNESDAY, Weekday.SUNDAY],
      sendAtTime: '18:30',
    };
    expect(
      isDiscoveryEmailDue(
        input({
          ...settings,
          nowWeekday: Weekday.WEDNESDAY,
          nowHourMinute: '18:30',
        }),
      ),
    ).toBe(true);
    expect(
      isDiscoveryEmailDue(
        input({
          ...settings,
          nowWeekday: Weekday.THURSDAY,
          nowHourMinute: '18:30',
        }),
      ),
    ).toBe(false);
  });
});

describe('app timezone helpers feeding the schedule', () => {
  it('reads the weekday and time of day in Berlin, not UTC', () => {
    const instant = new Date('2026-10-03T22:30:00Z');
    expect(appWeekday(instant)).toBe(Weekday.SUNDAY);
    expect(appHourMinute(instant)).toBe('00:30');
  });

  it('reads the winter offset', () => {
    const instant = new Date('2026-01-01T07:00:00Z');
    expect(appHourMinute(instant)).toBe('08:00');
  });
});

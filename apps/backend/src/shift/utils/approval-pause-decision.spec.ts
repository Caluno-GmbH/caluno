import { describe, expect, it } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import {
  type ApprovalPauseInput,
  isApprovalPaused,
} from './approval-pause-decision';

function input(
  overrides: Partial<ApprovalPauseInput> = {},
): ApprovalPauseInput {
  return {
    joinRequiresApproval: true,
    automationEnabled: true,
    activeDays: [Weekday.SATURDAY, Weekday.SUNDAY],
    leadTimeHours: 48,
    shiftWeekday: Weekday.SATURDAY,
    hoursUntilStart: 20,
    minVolunteers: 3,
    filledCount: 1,
    ...overrides,
  };
}

describe('isApprovalPaused', () => {
  it('pauses approval for an understaffed shift inside the window', () => {
    expect(isApprovalPaused(input())).toBe(true);
  });

  it('leaves shifts that never required approval alone', () => {
    expect(isApprovalPaused(input({ joinRequiresApproval: false }))).toBe(
      false,
    );
  });

  it('does nothing while the automation is switched off', () => {
    expect(isApprovalPaused(input({ automationEnabled: false }))).toBe(false);
  });

  it('never affects a shift without a minimum', () => {
    expect(isApprovalPaused(input({ minVolunteers: null }))).toBe(false);
  });

  it('applies approval again once the shift reaches its minimum', () => {
    expect(isApprovalPaused(input({ filledCount: 3 }))).toBe(false);
    expect(isApprovalPaused(input({ filledCount: 4 }))).toBe(false);
  });

  it('only covers shifts falling on an active day', () => {
    expect(isApprovalPaused(input({ shiftWeekday: Weekday.WEDNESDAY }))).toBe(
      false,
    );
    expect(isApprovalPaused(input({ shiftWeekday: Weekday.SUNDAY }))).toBe(
      true,
    );
  });

  it('does nothing while the shift is further out than the lead time', () => {
    expect(isApprovalPaused(input({ hoursUntilStart: 49 }))).toBe(false);
    expect(isApprovalPaused(input({ hoursUntilStart: 48 }))).toBe(true);
  });

  it('keeps covering a shift that has already started', () => {
    expect(isApprovalPaused(input({ hoursUntilStart: -1 }))).toBe(true);
  });

  it('does nothing when no lead time is configured', () => {
    expect(isApprovalPaused(input({ leadTimeHours: null }))).toBe(false);
  });

  it('does nothing when no day is selected', () => {
    expect(isApprovalPaused(input({ activeDays: [] }))).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { TimeEntryStatus } from '@repo/data';
import { TIME_ENTRY_STATUS_DISPLAY } from '../../time-entry-status';

describe('TIME_ENTRY_STATUS_DISPLAY', () => {
  it('maps every status to a badge variant and label key', () => {
    expect(TIME_ENTRY_STATUS_DISPLAY).toEqual({
      [TimeEntryStatus.Open]: { variant: 'neutral', labelKey: 'open' },
      [TimeEntryStatus.Closed]: { variant: 'success', labelKey: 'closed' },
      [TimeEntryStatus.AutoClosed]: {
        variant: 'alert',
        labelKey: 'autoClosed',
      },
    });
  });

  it('covers all TimeEntryStatus values', () => {
    expect(Object.keys(TIME_ENTRY_STATUS_DISPLAY).sort()).toEqual(
      Object.values(TimeEntryStatus).sort(),
    );
  });
});

import { TimeEntryStatus } from '@repo/data';

export type TimeEntryStatusBadgeVariant = 'neutral' | 'success' | 'alert';
export type TimeEntryStatusLabelKey = 'open' | 'closed' | 'autoClosed';

/** Badge variant and `TimeEntry.status.*` message key for each status. */
export const TIME_ENTRY_STATUS_DISPLAY: Record<
  TimeEntryStatus,
  { variant: TimeEntryStatusBadgeVariant; labelKey: TimeEntryStatusLabelKey }
> = {
  [TimeEntryStatus.Open]: { variant: 'neutral', labelKey: 'open' },
  [TimeEntryStatus.Closed]: { variant: 'success', labelKey: 'closed' },
  [TimeEntryStatus.AutoClosed]: { variant: 'alert', labelKey: 'autoClosed' },
};

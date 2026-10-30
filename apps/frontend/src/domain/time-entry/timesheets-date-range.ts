import { TZDate } from '@date-fns/tz';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';

/**
 * Converts calendar-day Date values (UTC-midnight, as produced by parseAsIsoDate)
 * into Europe/Berlin day-boundary UTC instants for use as query variables.
 *
 * Returns:
 *   dateFrom — start of the selected calendar day in Europe/Berlin (inclusive lower bound)
 *   dateTo   — start of the day AFTER the selected end calendar day in Europe/Berlin
 *              (exclusive upper bound; backend uses startedAt < dateTo)
 *
 * Only includes a key when its input is non-null.
 */
export function toTimesheetDateRange(
  dateFrom: Date | null,
  dateTo: Date | null,
): { dateFrom?: string; dateTo?: string } {
  const result: { dateFrom?: string; dateTo?: string } = {};

  if (dateFrom) {
    result.dateFrom = new Date(
      new TZDate(
        dateFrom.getUTCFullYear(),
        dateFrom.getUTCMonth(),
        dateFrom.getUTCDate(),
        DEFAULT_TIMEZONE,
      ).getTime(),
    ).toISOString();
  }

  if (dateTo) {
    result.dateTo = new Date(
      new TZDate(
        dateTo.getUTCFullYear(),
        dateTo.getUTCMonth(),
        dateTo.getUTCDate() + 1,
        DEFAULT_TIMEZONE,
      ).getTime(),
    ).toISOString();
  }

  return result;
}

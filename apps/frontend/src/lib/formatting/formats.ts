import { tz } from '@date-fns/tz';
import {
  format as dateFnsFormat,
  formatDuration as dateFnsFormatDuration,
  intervalToDuration,
  isSameDay,
  parseISO,
} from 'date-fns';
import { intlLocaleTag, localeDateFns } from '@/i18n/locales';

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formats = (locale: string) => {
  // Parse date strings with date-fns (never `new Date(string)`) so parsing is
  // engine- and timezone-independent across SSR and the client.
  const toDate = (value: string | Date): Date =>
    value instanceof Date ? value : parseISO(value);

  const format = (date: Date, formatting: string) =>
    dateFnsFormat(date, formatting, {
      locale: localeDateFns(locale),
      in: tz(DEFAULT_TIMEZONE),
    });

  const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
    if (options) {
      return new Intl.DateTimeFormat(intlLocaleTag(locale), {
        timeZone: DEFAULT_TIMEZONE,
        ...options,
      }).format(date);
    }
    return format(date, 'P');
  };
  const formatDateTime = (date: Date) => format(date, 'Pp');
  const formatTime = (date: Date) => format(date, 'p');

  const formatRange = (
    from: string | Date,
    to?: string | Date | null,
    noEndDateLabel = 'open',
    fromFormat = 'Pp',
    toFormat = 'Pp',
  ) => {
    const fromDate = new Date(from);

    if (to) {
      const toDate = new Date(to);

      if (isSameDay(to, from, { in: tz(DEFAULT_TIMEZONE) })) {
        return `${formatDate(fromDate)} ${formatTime(fromDate)} - ${formatTime(toDate)}`;
      }

      return `${format(fromDate, fromFormat)} - ${format(toDate, toFormat)}`;
    } else {
      return `${format(fromDate, fromFormat)} - ${noEndDateLabel}`;
    }
  };

  const formatDateRange = (from: string | Date, to: string | Date) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    return new Intl.DateTimeFormat(intlLocaleTag(locale), {
      timeZone: DEFAULT_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatRange(fromDate, toDate);
  };

  const formatTimeRange = (from: string | Date, to: string | Date) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    return `${formatTime(fromDate)} - ${formatTime(toDate)}`;
  };

  // Splits a worked period into a date line and a time-range line. When the
  // entry crosses midnight in Europe/Berlin, the end date is appended to the
  // time line so the range is unambiguous.
  const formatWorkedPeriod = (
    from: string | Date,
    to?: string | Date | null,
    openLabel = 'open',
  ): { date: string; time: string } => {
    const fromDate = toDate(from);
    const date = formatDate(fromDate);

    if (!to) {
      return { date, time: `${formatTime(fromDate)} - ${openLabel}` };
    }

    const toDateValue = toDate(to);
    const crossesDay = !isSameDay(fromDate, toDateValue, {
      in: tz(DEFAULT_TIMEZONE),
    });
    const endSuffix = crossesDay ? ` (${formatDate(toDateValue)})` : '';

    return {
      date,
      time: `${formatTime(fromDate)} - ${formatTime(toDateValue)}${endSuffix}`,
    };
  };

  const formatDuration = (from: Date | string, to?: Date | string | null) => {
    const start = new Date(from);
    const end = to ? new Date(to) : new Date();

    const duration = intervalToDuration(
      { start, end },
      { in: tz(DEFAULT_TIMEZONE) },
    );

    return dateFnsFormatDuration(duration, {
      zero: false,
      format: ['days', 'hours', 'minutes'],
      locale: localeDateFns(locale),
    });
  };

  const formatDurationByMinutes = (minutes: number): string => {
    const duration = intervalToDuration(
      { start: 0, end: minutes * 60 * 1000 },
      { in: tz(DEFAULT_TIMEZONE) },
    );

    return dateFnsFormatDuration(duration, {
      zero: false,
      format: ['days', 'hours', 'minutes'],
      locale: localeDateFns(locale),
    });
  };

  return {
    formatDate,
    formatDateTime,
    formatTime,
    formatRange,
    formatDateRange,
    formatTimeRange,
    formatWorkedPeriod,
    formatDuration,
    formatDurationByMinutes,
  };
};

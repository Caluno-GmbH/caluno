import { parseISO } from 'date-fns';
import { intlLocaleTag } from '@/i18n/locales';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';

const DAY_MS = 86_400_000;

/** Today is urgent; tomorrow is a warning. Later days stay in the meta colour. */
export type DayTone = 'danger' | 'warning' | 'neutral';

export interface UpcomingWhen {
  /** "Today" / "Tomorrow", or a calendar day for later starts. */
  dayLabel: string;
  /** Calendar day only, e.g. "Wed 7 Oct". No relative wording. */
  dateLabel: string;
  /** Start clock only, used when two cards share a title and a day. */
  startTime: string;
  /** Set when the start is 2–7 days away, e.g. "in 6 days". */
  relative?: string;
  tone: DayTone;
}

export interface DaysAway {
  /** "Today", "Tomorrow", or "In 6 days". */
  label: string;
  tone: DayTone;
}

export interface AppliedWhen {
  /** "today" / "6 days ago" / "3 weeks ago", already in the active locale. */
  relative: string;
  /** Whole calendar days since the application. Today is 0. */
  days: number;
  /** At or after the section threshold uses the warning colour. */
  tone: 'warning' | 'neutral';
}

export interface StatusAge {
  /** "3 days ago" / "vor 3 Tagen", already in the active locale. */
  relative: string;
  /** Whole calendar days since the status change. Today is 0. */
  days: number;
  /** At or after the section threshold uses the warning colour. */
  tone: 'warning' | 'neutral';
}

/**
 * Calendar days after which a waiting chip turns amber.
 * The threshold day itself is amber. Red is reserved for "Today".
 */
export const STATUS_WARNING_AFTER_DAYS = {
  reviewApplications: { warning: 7 },
  declinedDocuments: { warning: 14 },
  countersignDocuments: { warning: 14 },
} as const;

/** Day phrases stay numeric through two weeks, then move to weeks. */
const RELATIVE_DAYS_BEFORE_WEEKS = 14;

interface WhenOptions {
  locale: string;
  /** Org timezone. Caluno orgs use Europe/Berlin. */
  timeZone?: string;
  now?: Date;
}

/**
 * Upcoming shift or event: day label, time range, and an optional "in N days".
 * "Today" is the calendar day in `timeZone`, not the browser or server zone.
 */
export function formatUpcomingWhen(
  startsAt: string | undefined,
  _endsAt: string | undefined,
  options: WhenOptions,
): UpcomingWhen | undefined {
  const start = parseInstant(startsAt);
  if (!start) return undefined;
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const now = options.now ?? new Date();
  const locale = intlLocaleTag(options.locale);
  const distance = calendarDayDistance(now, start, timeZone);

  return {
    dayLabel: upcomingDayLabel(start, distance, locale, timeZone, now),
    dateLabel: formatCalendarDay(start, locale, timeZone, {
      weekday: true,
      year: yearOf(start, timeZone) !== yearOf(now, timeZone),
    }),
    startTime: formatClock(start, locale, timeZone),
    relative:
      distance >= 2 && distance <= 7
        ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
            distance,
            'day',
          )
        : undefined,
    tone: distance === 0 ? 'danger' : distance === 1 ? 'warning' : 'neutral',
  };
}

/**
 * How soon a shift starts, for the days-away chip.
 * Today and tomorrow are named; 2–14 days use "In N days". Later starts
 * have no chip — the calendar day on the card is enough.
 */
export function formatDaysAway(
  startsAt: string | undefined,
  options: WhenOptions,
): DaysAway | undefined {
  const start = parseInstant(startsAt);
  if (!start) return undefined;
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const now = options.now ?? new Date();
  const locale = intlLocaleTag(options.locale);
  const distance = calendarDayDistance(now, start, timeZone);

  if (start.getTime() < now.getTime()) {
    console.warn(`To do card for a start that has already passed: ${startsAt}`);
    return {
      label: startedLabel(options.locale),
      tone: 'neutral',
    };
  }

  if (distance === 0 || distance === 1) {
    return {
      label: capitalize(
        new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
          distance,
          'day',
        ),
        locale,
      ),
      tone: distance === 0 ? 'danger' : 'warning',
    };
  }

  if (distance >= 2 && distance <= 14) {
    return {
      label: capitalize(
        new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
          distance,
          'day',
        ),
        locale,
      ),
      tone: 'neutral',
    };
  }

  return undefined;
}

/**
 * How long ago someone applied. Always a relative phrase: days through the
 * warning threshold, then weeks, months, and years. Never a calendar date.
 */
export function formatAppliedWhen(
  at: string | undefined,
  options: WhenOptions,
): AppliedWhen | undefined {
  const instant = parseInstant(at);
  if (!instant) return undefined;
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const now = options.now ?? new Date();
  const locale = intlLocaleTag(options.locale);
  const days = Math.max(0, calendarDayDistance(instant, now, timeZone));
  const months = Math.max(0, calendarMonthDistance(instant, now, timeZone));

  return {
    relative: pastPhrase(days, months, locale),
    days,
    tone: statusTone(
      days,
      STATUS_WARNING_AFTER_DAYS.reviewApplications.warning,
    ),
  };
}

/** Days since a document was declined or signed. Stays relative past 14 days. */
export function formatStatusAge(
  at: string | undefined,
  options: WhenOptions & { warningAfterDays: number },
): StatusAge | undefined {
  const instant = parseInstant(at);
  if (!instant) return undefined;
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const now = options.now ?? new Date();
  const locale = intlLocaleTag(options.locale);
  const days = Math.max(0, calendarDayDistance(instant, now, timeZone));

  return {
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -days,
      'day',
    ),
    days,
    tone: statusTone(days, options.warningAfterDays),
  };
}

function statusTone(
  days: number,
  warningAfterDays: number,
): 'warning' | 'neutral' {
  return days >= warningAfterDays ? 'warning' : 'neutral';
}

function startedLabel(locale: string): string {
  return intlLocaleTag(locale).startsWith('de') ? 'Begonnen' : 'Started';
}

function pastPhrase(days: number, months: number, locale: string): string {
  const format = (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    numeric: 'auto' | 'always',
  ) => new Intl.RelativeTimeFormat(locale, { numeric }).format(-value, unit);

  if (days <= 1) return format(days, 'day', 'auto');
  if (days <= RELATIVE_DAYS_BEFORE_WEEKS) return format(days, 'day', 'always');
  if (months < 1) {
    return format(Math.max(1, Math.floor(days / 7)), 'week', 'always');
  }
  if (months < 12) return format(months, 'month', 'always');
  return format(Math.floor(months / 12), 'year', 'always');
}

/** Whole calendar months from `from` to `to` in `timeZone`. Negative when `to` is earlier. */
function calendarMonthDistance(from: Date, to: Date, timeZone: string): number {
  const start = zonedParts(from, timeZone);
  const end = zonedParts(to, timeZone);
  let months = (end.year - start.year) * 12 + (end.month - start.month);
  if (end.day < start.day) months -= 1;
  return months;
}

function capitalize(label: string, locale: string): string {
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function upcomingDayLabel(
  start: Date,
  distance: number,
  locale: string,
  timeZone: string,
  now: Date,
): string {
  if (distance === -1 || distance === 0 || distance === 1) {
    const label = new Intl.RelativeTimeFormat(locale, {
      numeric: 'auto',
    }).format(distance, 'day');
    return capitalize(label, locale);
  }
  return formatCalendarDay(start, locale, timeZone, {
    weekday: true,
    year: yearOf(start, timeZone) !== yearOf(now, timeZone),
  });
}

function formatCalendarDay(
  date: Date,
  locale: string,
  timeZone: string,
  options: { weekday?: boolean; year?: boolean },
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: options.weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: options.year ? 'numeric' : undefined,
  }).format(date);
}

function formatClock(date: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** `YYYY-MM-DD` of `instant` in `timeZone`. */
export function zonedDayKey(
  instant: string | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string | undefined {
  const date = parseInstant(instant);
  if (!date) return undefined;
  const { year, month, day } = zonedParts(date, timeZone);
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

/**
 * Cards that need a start time because another visible card has the same
 * title on the same org-timezone day. Every card in that group is included.
 */
export function idsSharingTitleAndDay(
  items: ReadonlyArray<{ id: string; title?: string; startsAt?: string }>,
  timeZone: string = DEFAULT_TIMEZONE,
): Set<string> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const day = zonedDayKey(item.startsAt, timeZone);
    const title = item.title?.trim();
    if (!day || !title) continue;
    const key = `${title}\0${day}`;
    const ids = groups.get(key);
    if (ids) ids.push(item.id);
    else groups.set(key, [item.id]);
  }
  const shared = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) shared.add(id);
  }
  return shared;
}

function yearOf(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).year;
}

/** Whole calendar days from `from` to `to` in `timeZone`. Negative when `to` is earlier. */
function calendarDayDistance(from: Date, to: Date, timeZone: string): number {
  return zonedDayNumber(to, timeZone) - zonedDayNumber(from, timeZone);
}

function zonedDayNumber(date: Date, timeZone: string): number {
  const { year, month, day } = zonedParts(date, timeZone);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function parseInstant(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

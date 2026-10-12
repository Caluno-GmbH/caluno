/**
 * The shapes a contract's "Vertragslaufzeit" (the manual `contract-lifespan`
 * template field, written by the template builder's period picker) can take.
 *
 * String to shape only. Turning a shape into Berlin day bounds stays with each
 * app, so this package carries no date maths and no timezone logic; it exists
 * so the frontend and the backend read the string with one set of rules.
 */

/** A calendar day as printed. */
export interface LifespanDay {
  year: number;
  /** 1 to 12, as printed. */
  month: number;
  day: number;
}

export type LifespanShape =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'range'; from: LifespanDay; to: LifespanDay };

const RANGE_PATTERN =
  /^(\d{2})\.(\d{2})\.(\d{4})\s*[–-]\s*(\d{2})\.(\d{2})\.(\d{4})$/;
const MONTH_PATTERN = /^(\d{2})\/(\d{4})$/;
const YEAR_PATTERN = /^(\d{4})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isRealMonth(month: number): boolean {
  return month >= 1 && month <= 12;
}

function isRealDay({ year, month, day }: LifespanDay): boolean {
  if (!isRealMonth(month) || day < 1) return false;
  const length =
    month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
  return day <= length;
}

function isNotAfter(a: LifespanDay, b: LifespanDay): boolean {
  if (a.year !== b.year) return a.year < b.year;
  if (a.month !== b.month) return a.month < b.month;
  return a.day <= b.day;
}

/**
 * Reads a lifespan string. Returns `undefined` for an empty or unreadable
 * value, a month outside 1 to 12, a day that does not exist, or a range that
 * ends before it starts, so callers can fall back or refuse explicitly instead
 * of silently rolling an impossible date into the next month.
 */
export function parseLifespanShape(value: string): LifespanShape | undefined {
  const text = value.trim();

  const range = text.match(RANGE_PATTERN);
  if (range) {
    const from = {
      year: Number(range[3]),
      month: Number(range[2]),
      day: Number(range[1]),
    };
    const to = {
      year: Number(range[6]),
      month: Number(range[5]),
      day: Number(range[4]),
    };
    if (!isRealDay(from) || !isRealDay(to) || !isNotAfter(from, to)) {
      return undefined;
    }
    return { kind: 'range', from, to };
  }

  const month = text.match(MONTH_PATTERN);
  if (month) {
    const monthNumber = Number(month[1]);
    if (!isRealMonth(monthNumber)) return undefined;
    return { kind: 'month', year: Number(month[2]), month: monthNumber };
  }

  const year = text.match(YEAR_PATTERN);
  if (year) return { kind: 'year', year: Number(year[1]) };

  return undefined;
}

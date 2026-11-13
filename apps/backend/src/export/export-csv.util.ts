export const EXPORT_TIME_ZONE = 'Europe/Berlin';

const INJECTION_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);
const NEEDS_QUOTING = /[,"\r\n]/;

/**
 * One RFC-4180 cell, with the OWASP CSV-injection guard: a value that starts
 * with a formula prefix is prefixed with `'`, so a spreadsheet renders it as
 * text instead of evaluating it.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (INJECTION_PREFIXES.has(str[0])) {
    str = `'${str}`;
  }
  if (NEEDS_QUOTING.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines: string[] = [];
  lines.push(header.map(csvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

type DatePart = 'day' | 'month' | 'year' | 'hour' | 'minute';

const berlinDateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: EXPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const berlinDateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: EXPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partGetter = (formatter: Intl.DateTimeFormat, date: Date) => {
  const parts = formatter.formatToParts(date);
  return (type: DatePart) =>
    parts.find((part) => part.type === type)?.value ?? '';
};

/** `dd.MM.yyyy HH:mm` in Europe/Berlin wall-clock time. */
export function formatBerlinDateTime(date: Date | null | undefined): string {
  if (date === null || date === undefined) return '';
  const get = partGetter(berlinDateTimeFormat, date);
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

/** `dd.MM.yyyy` in Europe/Berlin — for date-only values such as a birthdate. */
export function formatBerlinDate(date: Date | null | undefined): string {
  if (date === null || date === undefined) return '';
  const get = partGetter(berlinDateFormat, date);
  return `${get('day')}.${get('month')}.${get('year')}`;
}

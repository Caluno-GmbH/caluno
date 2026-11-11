export const EXPORT_TIME_ZONE = 'Europe/Berlin';

const INJECTION_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);
const NEEDS_QUOTING = /[,"\r\n]/;

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
  return lines.join('\r\n') + '\r\n';
}

const berlinDateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: EXPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatBerlinDateTime(date: Date | null | undefined): string {
  if (date === null || date === undefined) return '';
  const parts = berlinDateTimeFormat.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

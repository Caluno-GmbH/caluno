import type { RawExportLogEntry } from '@repo/data';

const INJECTION_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

function csvCell(value: string): string {
  let str = value;
  const first = str[0];
  if (first !== undefined && INJECTION_PREFIXES.has(first)) {
    str = `'${str}`;
  }
  if (/[,"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeExportLogToCsv(
  entries: RawExportLogEntry[],
  headers: string[],
  formatDateTime: (iso: string) => string,
): string {
  const rows: string[] = [headers.map(csvCell).join(',')];

  for (const entry of entries) {
    const cells = [
      formatDateTime(entry.occurredAt),
      entry.actorName,
      entry.tableKind,
      entry.columns.join('; '),
      String(entry.rowCount),
      String(entry.subjectUserIds.length),
      entry.subjectUserIds.join('; '),
    ];
    rows.push(cells.map(csvCell).join(','));
  }

  return rows.join('\r\n') + '\r\n';
}

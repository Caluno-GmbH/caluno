import type { RawExportLogEntry } from '@repo/data';

function csvCell(value: string): string {
  if (/[,"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

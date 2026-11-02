import type { GetTimeEntriesQuery } from '@repo/data';
import { entryDurationMinutes, resolveTimeEntryLocation } from './location';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function entryToRow(entry: TimeEntry): string {
  const duration = entryDurationMinutes(entry);
  const cells = [
    entry.volunteer?.name ?? entry.volunteer?.email ?? '',
    entry.volunteer?.email ?? '',
    entry.shiftInstance?.master?.title ?? '',
    entry.shiftInstance?.overrideTitle ??
      entry.shiftInstance?.master?.title ??
      '',
    resolveTimeEntryLocation(entry) ?? '',
    entry.startedAt,
    entry.endedAt ?? '',
    duration !== null ? String(duration) : '',
    entry.status,
    entry.createdBy?.name ?? entry.createdBy?.email ?? '',
    entry.notes ?? '',
  ];
  return cells.map(escapeCell).join(',');
}

export function serializeTimesheetsToCsv(
  entries: TimeEntry[],
  headers: string[],
): string {
  const header = headers.map(escapeCell).join(',');
  const rows = entries.map(entryToRow);
  return [header, ...rows].join('\n');
}

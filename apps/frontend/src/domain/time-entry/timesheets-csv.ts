import { tz } from '@date-fns/tz';
import type { GetTimeEntriesQuery } from '@repo/data';
import { format, parseISO } from 'date-fns';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import { entryDurationMinutes, resolveTimeEntryLocation } from './location';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

const appTz = { in: tz(DEFAULT_TIMEZONE) };

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatLocalDateTime(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd HH:mm:ss', appTz);
}

function entryToRow(entry: TimeEntry): string {
  const duration = entryDurationMinutes(entry);
  const cells = [
    entry.volunteer?.name ?? entry.volunteer?.email ?? '',
    entry.volunteer?.email ?? '',
    entry.shiftInstance?.overrideTitle ??
      entry.shiftInstance?.master?.title ??
      '',
    resolveTimeEntryLocation(entry) ?? '',
    formatLocalDateTime(entry.startedAt),
    entry.endedAt ? formatLocalDateTime(entry.endedAt) : '',
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

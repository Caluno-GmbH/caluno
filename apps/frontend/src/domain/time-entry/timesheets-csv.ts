import type { GetTimeEntriesQuery } from '@repo/data';
import { resolveTimeEntryLocation } from './location';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

const HEADERS = [
  'Volunteer Name',
  'Volunteer Email',
  'Shift',
  'Assignment',
  'Location',
  'Started At',
  'Ended At',
  'Duration (min)',
  'Status',
  'Created By',
  'Notes',
];

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function durationMinutes(entry: TimeEntry): string {
  if (!entry.endedAt) return '';
  const mins = Math.round(
    (new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) /
      60_000,
  );
  return String(mins);
}

function entryToRow(entry: TimeEntry): string {
  const cells = [
    entry.volunteer.name ?? entry.volunteer.email,
    entry.volunteer.email,
    entry.shiftInstance?.master.title ?? '',
    entry.shiftInstance?.overrideTitle ??
      entry.shiftInstance?.master.title ??
      '',
    resolveTimeEntryLocation(entry) ?? '',
    entry.startedAt,
    entry.endedAt ?? '',
    durationMinutes(entry),
    entry.status,
    entry.createdBy?.name ?? entry.createdBy?.email ?? '',
    entry.notes ?? '',
  ];
  return cells.map(escapeCell).join(',');
}

export function serializeTimesheetsToCsv(entries: TimeEntry[]): string {
  const header = HEADERS.map(escapeCell).join(',');
  const rows = entries.map(entryToRow);
  return [header, ...rows].join('\n');
}

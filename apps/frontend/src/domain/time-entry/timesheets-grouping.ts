import type { GetTimeEntriesQuery } from '@repo/data';
import { sumDurationMinutes } from './location';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

export interface TimesheetVolunteerGroup {
  kind: 'volunteer';
  id: string;
  volunteer: TimeEntry['volunteer'];
  totalDurationMinutes: number;
  entryCount: number;
  subRows: TimeEntry[];
}

export interface TimesheetAssignmentGroup {
  kind: 'assignment';
  id: string;
  title: string;
  totalDurationMinutes: number;
  entryCount: number;
  subRows: TimeEntry[];
}

export type TimesheetGroupRow = TimesheetVolunteerGroup | TimesheetAssignmentGroup;

export function groupByVolunteer(entries: TimeEntry[]): TimesheetVolunteerGroup[] {
  const map = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = entry.volunteer.id;
    const group = map.get(key) ?? [];
    group.push(entry);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([, rows]) => ({
    kind: 'volunteer' as const,
    id: rows[0]!.volunteer.id,
    volunteer: rows[0]!.volunteer,
    totalDurationMinutes: sumDurationMinutes(rows),
    entryCount: rows.length,
    subRows: rows,
  }));
}

export function groupByAssignment(entries: TimeEntry[]): TimesheetAssignmentGroup[] {
  const map = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = entry.shiftInstance
      ? entry.shiftInstance.master.id
      : `shiftless-${entry.organizationUnit.id}`;
    const group = map.get(key) ?? [];
    group.push(entry);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([key, rows]) => {
    const first = rows[0]!;
    const title = first.shiftInstance
      ? (first.shiftInstance.overrideTitle ?? first.shiftInstance.master.title)
      : first.organizationUnit.name;
    return {
      kind: 'assignment' as const,
      id: key,
      title,
      totalDurationMinutes: sumDurationMinutes(rows),
      entryCount: rows.length,
      subRows: rows,
    };
  });
}

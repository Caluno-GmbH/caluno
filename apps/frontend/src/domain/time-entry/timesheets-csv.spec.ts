import { describe, expect, it } from 'bun:test';
import { type GetTimeEntriesQuery, TimeEntryStatus } from '@repo/data';
import { serializeTimesheetsToCsv } from './timesheets-csv';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

const HEADERS = [
  'Volunteer Name',
  'Volunteer Email',
  'Assignment',
  'Location',
  'Started At',
  'Ended At',
  'Duration (min)',
  'Status',
  'Created By',
  'Notes',
];

const baseEntry = (): TimeEntry => ({
  id: 'e1',
  status: TimeEntryStatus.Closed,
  startedAt: '2024-01-01T08:00:00Z',
  endedAt: '2024-01-01T10:00:00Z',
  notes: null,
  createdAt: '2024-01-01T07:00:00Z',
  createdBy: null,
  volunteer: { id: 'v1', name: 'Alice Müller', email: 'alice@test.com' },
  shiftInstance: {
    id: 'si1',
    overrideLocation: null,
    overrideTitle: null,
    actualStartsAt: '2024-01-01T08:00:00Z',
    actualEndsAt: '2024-01-01T10:00:00Z',
    master: { id: 'm1', title: 'Shift A', location: null },
  },
  organizationUnit: {
    id: 'ou1',
    name: 'Unit',
    street: null,
    zipCode: null,
    city: null,
    organization: { id: 'o1', name: 'Org' },
  },
});

describe('serializeTimesheetsToCsv', () => {
  it('produces a header row with Volunteer Name as first column', () => {
    const csv = serializeTimesheetsToCsv([], HEADERS);
    expect(csv.split('\n')[0]).toContain('Volunteer Name');
  });

  it('produces one data row per entry', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()], HEADERS);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('escapes commas in volunteer name', () => {
    const e: TimeEntry = {
      ...baseEntry(),
      volunteer: { id: 'v1', name: 'Doe, Jane', email: 'jane@test.com' },
    };
    const csv = serializeTimesheetsToCsv([e], HEADERS);
    expect(csv).toContain('"Doe, Jane"');
  });

  it('escapes double-quotes in a field', () => {
    const e: TimeEntry = { ...baseEntry(), notes: 'She said "hello"' };
    const csv = serializeTimesheetsToCsv([e], HEADERS);
    expect(csv).toContain('"She said ""hello"""');
  });

  it('computes duration in minutes', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()], HEADERS);
    expect(csv.trim().split('\n')[1]).toContain('120');
  });

  it('formats startedAt and endedAt in Europe/Berlin as yyyy-MM-dd HH:mm:ss', () => {
    // 08:00Z / 10:00Z → 09:00 / 11:00 CET
    const csv = serializeTimesheetsToCsv([baseEntry()], HEADERS);
    const dataLine = csv.trim().split('\n')[1] ?? '';
    // split('","') keeps a leading " on cell 0; indices: 4=startedAt, 5=endedAt
    const cells = dataLine.split('","');
    expect(cells[4]).toBe('2024-01-01 09:00:00');
    expect(cells[5]).toBe('2024-01-01 11:00:00');
  });

  it('leaves duration and endedAt empty for open entries (no endedAt)', () => {
    const e: TimeEntry = { ...baseEntry(), endedAt: null };
    const csv = serializeTimesheetsToCsv([e], HEADERS);
    const dataLine = csv.trim().split('\n')[1] ?? '';
    const cells = dataLine.split('","');
    expect(cells[5]).toBe(''); // endedAt
    expect(cells[6]).toBe(''); // duration
  });

  it('includes shift title', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()], HEADERS);
    expect(csv).toContain('Shift A');
  });

  it('returns only header for empty array', () => {
    const csv = serializeTimesheetsToCsv([], HEADERS);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });
});

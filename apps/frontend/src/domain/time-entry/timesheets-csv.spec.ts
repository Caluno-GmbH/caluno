import { describe, expect, it } from 'bun:test';
import { serializeTimesheetsToCsv } from './timesheets-csv';

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

const baseEntry = () => ({
  id: 'e1',
  status: 'Closed' as const,
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
    const header = csv.split('\n')[0]!;
    expect(header).toContain('Volunteer Name');
  });

  it('produces one data row per entry', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()] as any, HEADERS);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('escapes commas in volunteer name', () => {
    const e = {
      ...baseEntry(),
      volunteer: { id: 'v1', name: 'Doe, Jane', email: 'jane@test.com' },
    };
    const csv = serializeTimesheetsToCsv([e] as any, HEADERS);
    expect(csv).toContain('"Doe, Jane"');
  });

  it('escapes double-quotes in a field', () => {
    const e = { ...baseEntry(), notes: 'She said "hello"' };
    const csv = serializeTimesheetsToCsv([e] as any, HEADERS);
    expect(csv).toContain('"She said ""hello"""');
  });

  it('computes duration in minutes', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()] as any, HEADERS);
    const dataLine = csv.trim().split('\n')[1]!;
    expect(dataLine).toContain('120');
  });

  it('leaves duration empty for open entries (no endedAt)', () => {
    const e = { ...baseEntry(), endedAt: null };
    const csv = serializeTimesheetsToCsv([e] as any, HEADERS);
    const dataLine = csv.trim().split('\n')[1]!;
    // Duration (min) column — 8th column (0-indexed: 7)
    const cells = dataLine.split('","');
    // Duration cell should be empty string
    expect(cells[7]).toBe('');
  });

  it('includes shift title', () => {
    const csv = serializeTimesheetsToCsv([baseEntry()] as any, HEADERS);
    expect(csv).toContain('Shift A');
  });

  it('returns only header for empty array', () => {
    const csv = serializeTimesheetsToCsv([], HEADERS);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });
});

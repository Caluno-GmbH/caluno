import { describe, expect, it } from 'bun:test';
import type { RawExportLogEntry } from '@repo/data';
import { ExportTable } from '@repo/data';
import { serializeExportLogToCsv } from './export-log-csv';

const fmtDate = (iso: string) => `[${iso}]`;

const headers = [
  'Timestamp',
  'Actor',
  'Table',
  'Columns',
  'Row Count',
  'Subject Count',
  'Subject IDs',
];

const entry: RawExportLogEntry = {
  id: 'e1',
  actorName: 'Alice',
  tableKind: ExportTable.Users,
  columns: ['name', 'email'],
  includedTechnicalIds: false,
  rowCount: 42,
  subjectUserIds: ['u1', 'u2'],
  occurredAt: '2024-01-15T10:00:00Z',
};

describe('serializeExportLogToCsv', () => {
  it('serializes a log entry row with actor, table, columns, row count, and subject ids', () => {
    const csv = serializeExportLogToCsv([entry], headers, fmtDate);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(headers.join(','));
    expect(lines[1]).toBe(
      '[2024-01-15T10:00:00Z],Alice,USERS,name; email,42,2,u1; u2',
    );
  });

  it('renders an empty log as header-only CSV', () => {
    const csv = serializeExportLogToCsv([], headers, fmtDate);
    expect(csv).toBe(`${headers.join(',')}\r\n`);
  });

  it('quotes cells containing a comma per RFC-4180', () => {
    const commaEntry: RawExportLogEntry = {
      ...entry,
      actorName: 'Smith, John',
    };
    const csv = serializeExportLogToCsv([commaEntry], headers, fmtDate);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('"Smith, John"');
  });

  it('neutralizes formula-injection prefixes in cells', () => {
    const injectionEntry: RawExportLogEntry = {
      ...entry,
      actorName: '=HYPERLINK("http://evil","x")',
    };
    const csv = serializeExportLogToCsv([injectionEntry], headers, fmtDate);
    const dataLine = csv.split('\r\n')[1];
    // Leading "'" neutralizer, then quoted because the value contains commas/quotes.
    expect(dataLine).toContain('"\'=HYPERLINK(""http://evil"",""x"")"');
  });
});

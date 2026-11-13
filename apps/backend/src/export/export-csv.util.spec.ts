import { describe, expect, it } from 'bun:test';
import {
  csvCell,
  formatBerlinDate,
  formatBerlinDateTime,
  rowsToCsv,
} from './export-csv.util';

describe('csvCell', () => {
  it('returns plain strings unchanged', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes cells containing commas, quotes, and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('neutralizes formula-injection prefixes', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@user')).toBe("'@user");
    expect(csvCell('\t tabbed')).toBe("'\t tabbed");
    // \r is both an injection prefix (guard adds ') and a RFC-quoting trigger
    expect(csvCell('\r return')).toBe(`"'\r return"`);
  });

  it('applies injection guard then RFC quoting (guard prefix needs quoting)', () => {
    expect(csvCell('=foo,bar')).toBe('"\'=foo,bar"');
  });
});

describe('formatBerlinDateTime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatBerlinDateTime(null)).toBe('');
    expect(formatBerlinDateTime(undefined)).toBe('');
  });

  it('renders a UTC instant in Europe/Berlin wall-clock (summer CEST UTC+2)', () => {
    const date = new Date('2024-07-15T10:00:00.000Z');
    expect(formatBerlinDateTime(date)).toBe('15.07.2024 12:00');
  });

  it('renders a UTC instant in Europe/Berlin wall-clock (winter CET UTC+1)', () => {
    const date = new Date('2024-01-15T10:00:00.000Z');
    expect(formatBerlinDateTime(date)).toBe('15.01.2024 11:00');
  });

  it('rolls to the next Berlin day near 23:30 UTC (summer)', () => {
    const date = new Date('2024-07-15T22:30:00.000Z');
    expect(formatBerlinDateTime(date)).toBe('16.07.2024 00:30');
  });
});

describe('formatBerlinDate', () => {
  it('renders date-only values without a time', () => {
    expect(formatBerlinDate(new Date('2024-01-15T10:00:00.000Z'))).toBe(
      '15.01.2024',
    );
    expect(formatBerlinDate(null)).toBe('');
  });
});

describe('rowsToCsv', () => {
  it('builds a CSV with header and rows', () => {
    const result = rowsToCsv(
      ['Name', 'Score', 'Note'],
      [
        ['Alice', 10, null],
        ['Bob, Jr.', 20, 'great "work"'],
      ],
    );
    expect(result).toBe(
      'Name,Score,Note\r\n' +
        'Alice,10,\r\n' +
        '"Bob, Jr.",20,"great ""work"""\r\n',
    );
  });
});

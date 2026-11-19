import { describe, expect, it } from 'bun:test';
import { BadRequestGraphQLError } from '../../graphql/errors';
import {
  type ExportColumnDefinition,
  resolveExportColumns,
  serializeExport,
} from './export-serializer';

const COLUMNS: readonly ExportColumnDefinition[] = [
  { id: 'name', label: 'Name', labelKey: 'export.columns.users.name' },
  { id: 'email', label: 'Email', labelKey: 'export.columns.users.email' },
  { id: 'notes', label: 'Notes', labelKey: 'export.columns.users.notes' },
];

describe('resolveExportColumns', () => {
  it('returns the selection in canonical order and drops duplicates', () => {
    expect(
      resolveExportColumns(COLUMNS, ['email', 'name', 'email']).map(
        (column) => column.id,
      ),
    ).toEqual(['name', 'email']);
  });

  it('rejects unknown column ids instead of silently dropping them', () => {
    expect(() => resolveExportColumns(COLUMNS, ['name', 'bogus'])).toThrow(
      BadRequestGraphQLError,
    );
  });

  it('rejects an empty selection', () => {
    expect(() => resolveExportColumns(COLUMNS, [])).toThrow(
      BadRequestGraphQLError,
    );
  });
});

describe('serializeExport', () => {
  it('writes the selected columns, then the technical id when requested', () => {
    const csv = serializeExport({
      columns: resolveExportColumns(COLUMNS, ['email', 'name']),
      rows: [
        {
          technicalId: 'user-1',
          cells: { name: 'Jane Doe', email: 'jane@example.com', notes: 'x' },
        },
      ],
      includeTechnicalIds: true,
      technicalIdLabel: 'User ID',
    });

    expect(csv).toBe(
      'Name,Email,User ID\r\nJane Doe,jane@example.com,user-1\r\n',
    );
  });

  it('guards formula injection in cell values', () => {
    const csv = serializeExport({
      columns: resolveExportColumns(COLUMNS, ['name']),
      rows: [{ technicalId: 'id', cells: { name: '=SUM(A1)' } }],
      includeTechnicalIds: false,
      technicalIdLabel: 'ID',
    });

    expect(csv.split('\r\n')[1]).toBe("'=SUM(A1)");
  });

  it('localizes headers through the translate callback', () => {
    const csv = serializeExport({
      columns: resolveExportColumns(COLUMNS, ['name', 'email']),
      rows: [],
      includeTechnicalIds: true,
      technicalIdLabel: 'User ID',
      technicalIdLabelKey: 'export.technicalIds.users',
      translate: (key) => {
        if (key === 'export.columns.users.name') return 'Nom';
        if (key === 'export.columns.users.email') return 'E-mail';
        if (key === 'export.technicalIds.users') return 'Identifiant';
        return key;
      },
    });

    expect(csv).toBe('Nom,E-mail,Identifiant\r\n');
  });

  it('falls back to the English label when a key has no translation', () => {
    const csv = serializeExport({
      columns: resolveExportColumns(COLUMNS, ['name']),
      rows: [],
      includeTechnicalIds: false,
      technicalIdLabel: 'ID',
      translate: (key) => key,
    });

    expect(csv).toBe('Name\r\n');
  });

  it('emits a header-only file for an empty selection', () => {
    const csv = serializeExport({
      columns: resolveExportColumns(COLUMNS, ['name', 'email']),
      rows: [],
      includeTechnicalIds: false,
      technicalIdLabel: 'ID',
    });

    expect(csv).toBe('Name,Email\r\n');
  });
});

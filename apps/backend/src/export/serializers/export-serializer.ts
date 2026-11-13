import { BadRequestGraphQLError } from '../../graphql/errors';
import { rowsToCsv } from '../export-csv.util';

export type ExportCell = string | number | null | undefined;

export interface ExportColumnDefinition {
  id: string;
  label: string;
}

export interface ExportRow {
  /** Value for the trailing technical-id column (e.g. the user id). */
  technicalId: string;
  cells: Readonly<Record<string, ExportCell>>;
}

/**
 * Validates the caller's column selection against the table's known columns and
 * returns them in canonical order. Unknown ids are rejected: silently dropping
 * them would produce a file that does not match the customization the user
 * confirmed.
 */
export function resolveExportColumns(
  definitions: readonly ExportColumnDefinition[],
  requested: readonly string[],
): ExportColumnDefinition[] {
  const known = new Set(definitions.map((definition) => definition.id));
  const unknown = [...new Set(requested)].filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new BadRequestGraphQLError(
      `Unknown export column(s): ${unknown.join(', ')}`,
    );
  }

  const selected = definitions.filter((definition) =>
    requested.includes(definition.id),
  );
  if (selected.length === 0) {
    throw new BadRequestGraphQLError('Select at least one column to export');
  }

  return selected;
}

export function serializeExport(options: {
  columns: readonly ExportColumnDefinition[];
  rows: readonly ExportRow[];
  includeTechnicalIds: boolean;
  technicalIdLabel: string;
}): string {
  const header = options.columns.map((column) => column.label);
  if (options.includeTechnicalIds) header.push(options.technicalIdLabel);

  const dataRows = options.rows.map((row) => {
    const cells = options.columns.map((column) => row.cells[column.id]);
    if (options.includeTechnicalIds) cells.push(row.technicalId);
    return cells;
  });

  return rowsToCsv(header, dataRows);
}

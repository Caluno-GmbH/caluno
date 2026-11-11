import { formatBerlinDateTime, rowsToCsv } from '../export-csv.util';

export interface ShiftExportRow {
  id: string;
  title: string | null | undefined;
  firstDate: Date | null;
  location: string | null | undefined;
  visibility: string | null | undefined;
  staffing: string | null | undefined;
}

type ColumnDef = {
  label: string;
  get: (row: ShiftExportRow) => string | number | null | undefined;
};

const COLUMN_DEFS: Record<string, ColumnDef> = {
  title: { label: 'Title', get: (r) => r.title },
  date: { label: 'Date', get: (r) => formatBerlinDateTime(r.firstDate) },
  location: { label: 'Location', get: (r) => r.location },
  visibility: { label: 'Visibility', get: (r) => r.visibility },
  staffing: { label: 'Staffing', get: (r) => r.staffing },
};

export const SHIFT_COLUMNS = Object.keys(COLUMN_DEFS);

export function serializeShiftExport(
  rows: ShiftExportRow[],
  columns: string[],
  includeTechnicalIds: boolean,
): string {
  const selected = SHIFT_COLUMNS.filter((id) => columns.includes(id)).map(
    (id) => COLUMN_DEFS[id],
  );

  const header = selected.map((c) => c.label);
  if (includeTechnicalIds) header.push('ID');

  const dataRows = rows.map((row) => {
    const cells = selected.map((c) => c.get(row));
    if (includeTechnicalIds) cells.push(row.id);
    return cells;
  });

  return rowsToCsv(header, dataRows);
}

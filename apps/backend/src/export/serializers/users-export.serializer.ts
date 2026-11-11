import { formatBerlinDateTime, rowsToCsv } from '../export-csv.util';

export interface UserExportRow {
  userId: string;
  name: string | null | undefined;
  email: string | null | undefined;
  roles: string[];
  dateOfBirth: Date | null;
  gender: string | null | undefined;
  phone: string | null | undefined;
  address: string | null | undefined;
}

type ColumnDef = {
  label: string;
  get: (row: UserExportRow) => string | number | null | undefined;
};

const COLUMN_DEFS: Record<string, ColumnDef> = {
  name: { label: 'Name', get: (r) => r.name },
  email: { label: 'Email', get: (r) => r.email },
  roles: { label: 'Roles', get: (r) => r.roles.join('; ') },
  dateOfBirth: {
    label: 'Date of Birth',
    get: (r) => formatBerlinDateTime(r.dateOfBirth),
  },
  gender: { label: 'Gender', get: (r) => r.gender },
  phone: { label: 'Phone', get: (r) => r.phone },
  address: { label: 'Address', get: (r) => r.address },
};

export const USER_COLUMNS = Object.keys(COLUMN_DEFS);

export function serializeUserExport(
  rows: UserExportRow[],
  columns: string[],
  includeTechnicalIds: boolean,
): string {
  const selected = USER_COLUMNS.filter((id) => columns.includes(id)).map(
    (id) => COLUMN_DEFS[id],
  );

  const header = selected.map((c) => c.label);
  if (includeTechnicalIds) header.push('User ID');

  const dataRows = rows.map((row) => {
    const cells = selected.map((c) => c.get(row));
    if (includeTechnicalIds) cells.push(row.userId);
    return cells;
  });

  return rowsToCsv(header, dataRows);
}

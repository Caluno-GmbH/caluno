import { formatBerlinDateTime, rowsToCsv } from '../export-csv.util';

export interface TimesheetExportRow {
  id: string;
  volunteerName: string | null | undefined;
  volunteerEmail: string | null | undefined;
  shift: string | null | undefined;
  assignment: string | null | undefined;
  location: string | null | undefined;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  status: string | null | undefined;
  createdBy: string | null | undefined;
  notes: string | null | undefined;
}

type ColumnDef = {
  label: string;
  get: (row: TimesheetExportRow) => string | number | null | undefined;
};

const COLUMN_DEFS: Record<string, ColumnDef> = {
  volunteerName: { label: 'Volunteer Name', get: (r) => r.volunteerName },
  volunteerEmail: { label: 'Volunteer Email', get: (r) => r.volunteerEmail },
  shift: { label: 'Shift', get: (r) => r.shift },
  assignment: { label: 'Assignment', get: (r) => r.assignment },
  location: { label: 'Location', get: (r) => r.location },
  startedAt: {
    label: 'Started At',
    get: (r) => formatBerlinDateTime(r.startedAt),
  },
  endedAt: { label: 'Ended At', get: (r) => formatBerlinDateTime(r.endedAt) },
  duration: { label: 'Duration (min)', get: (r) => r.durationMinutes },
  status: { label: 'Status', get: (r) => r.status },
  createdBy: { label: 'Created By', get: (r) => r.createdBy },
  notes: { label: 'Notes', get: (r) => r.notes },
};

export const TIMESHEET_COLUMNS = Object.keys(COLUMN_DEFS);

export function serializeTimesheetExport(
  rows: TimesheetExportRow[],
  columns: string[],
  includeTechnicalIds: boolean,
): string {
  const selected = TIMESHEET_COLUMNS.filter((id) => columns.includes(id)).map(
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

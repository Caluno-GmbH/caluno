import { useTranslations } from 'next-intl';
import type { ExportColumnOption } from '@/components/export/export-column-option';

type ColumnMeta = Omit<ExportColumnOption, 'label'>;

const COLUMN_META: ColumnMeta[] = [
  { id: 'volunteerName', optional: false, defaultOn: true },
  { id: 'volunteerEmail', optional: true, defaultOn: true },
  { id: 'shift', optional: true, defaultOn: true },
  { id: 'assignment', optional: true, defaultOn: true },
  { id: 'location', optional: true, defaultOn: true },
  { id: 'startedAt', optional: true, defaultOn: true },
  { id: 'endedAt', optional: true, defaultOn: true },
  { id: 'duration', optional: true, defaultOn: true },
  { id: 'status', optional: true, defaultOn: true },
  { id: 'createdBy', optional: true, defaultOn: true },
  { id: 'notes', optional: true, defaultOn: true },
];

export const TIMESHEET_EXPORT_COLUMNS: ColumnMeta[] = COLUMN_META;

export function useTimesheetExportColumns(): ExportColumnOption[] {
  const t = useTranslations('Export');
  return COLUMN_META.map((col) => ({
    ...col,
    label: t(`columns.timesheets.${col.id}`),
  }));
}

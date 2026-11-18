import { useTranslations } from 'next-intl';
import type { ExportColumnOption } from '@/components/export/export-column-option';

type ColumnMeta = Omit<ExportColumnOption, 'label'>;

const COLUMN_META: ColumnMeta[] = [
  { id: 'title', optional: false, defaultOn: true },
  { id: 'date', optional: true, defaultOn: true },
  { id: 'location', optional: true, defaultOn: true },
  { id: 'visibility', optional: true, defaultOn: true },
  { id: 'staffing', optional: true, defaultOn: true },
];

export const SHIFT_EXPORT_COLUMNS: ColumnMeta[] = COLUMN_META;

export function useShiftExportColumns(): ExportColumnOption[] {
  const t = useTranslations('Export');
  return COLUMN_META.map((col) => ({
    ...col,
    label: t(`columns.shifts.${col.id}`),
    description: t(`descriptions.shifts.${col.id}`),
  }));
}

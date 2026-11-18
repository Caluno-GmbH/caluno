import { useTranslations } from 'next-intl';
import type { ExportColumnOption } from '@/components/export/export-column-option';

type ColumnMeta = Omit<ExportColumnOption, 'label'>;

const COLUMN_META: ColumnMeta[] = [
  { id: 'name', optional: false, defaultOn: true },
  { id: 'email', optional: true, defaultOn: true },
  { id: 'roles', optional: true, defaultOn: true },
  { id: 'dateOfBirth', optional: true, defaultOn: false },
  { id: 'gender', optional: true, defaultOn: false },
  { id: 'phone', optional: true, defaultOn: false },
  { id: 'address', optional: true, defaultOn: false },
];

export const VOLUNTEER_EXPORT_COLUMNS: ColumnMeta[] = COLUMN_META;

export function useVolunteerExportColumns(): ExportColumnOption[] {
  const t = useTranslations('Export');
  return COLUMN_META.map((col) => ({
    ...col,
    label: t(`columns.users.${col.id}`),
    description: t(`descriptions.users.${col.id}`),
  }));
}

import type { TimeEntryStatus } from '@repo/data';
import { Badge } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { TIME_ENTRY_STATUS_DISPLAY } from '../time-entry-status';

export const TimeEntryStatusBadge = ({
  status,
}: {
  status: TimeEntryStatus;
}) => {
  const t = useTranslations('TimeEntry.status');
  const { variant, labelKey } = TIME_ENTRY_STATUS_DISPLAY[status];
  return <Badge variant={variant}>{t(labelKey)}</Badge>;
};

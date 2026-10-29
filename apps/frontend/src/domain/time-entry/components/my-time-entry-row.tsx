import { TimeEntryStatus } from '@repo/data';
import { Card, CardContent } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { getEntryState, type TimeEntry } from '../my-time-grouping';
import { TimeEntryStatusBadge } from './time-entry-status-badge';

export const MyTimeEntryRow = ({ entry }: { entry: TimeEntry }) => {
  const t = useTranslations('MyTime');
  const { formatDuration } = useFormatting();

  const state = getEntryState(entry);
  const shift = entry.shiftInstance?.master;
  const organizationUnit = shift?.organizationUnit ?? entry.organizationUnit;
  // Shown for auto-closed entries too, but never totalled (see groupMyTime).
  const duration =
    state === TimeEntryStatus.Open
      ? ''
      : formatDuration(entry.startedAt, entry.endedAt);

  return (
    <Card className="py-4">
      <CardContent className="">
        <h2 className="truncate">
          {entry.shiftInstance
            ? (entry.shiftInstance.overrideTitle ?? shift?.title)
            : t('generalTime')}
        </h2>
        <h3 className="truncate text-sm text-muted-foreground">
          {organizationUnit.organization.name} · {organizationUnit.name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base">{duration}</span>
          <TimeEntryStatusBadge status={state} />
        </div>
      </CardContent>
    </Card>
  );
};

'use client';

import type { GetTimeEntriesQuery } from '@repo/data';
import { Button } from '@repo/ui';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { serializeTimesheetsToCsv } from '@/domain/time-entry/timesheets-csv';
import { resolveTimeEntryLocation } from '@/domain/time-entry/location';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface DownloadCsvButtonProps {
  orgUnitId: string;
  locationFilter: string | null;
  isLoadingFull: boolean;
  fullEntries: TimeEntry[] | undefined;
  onTriggerLoad: () => void;
}

export function DownloadCsvButton({
  orgUnitId,
  locationFilter,
  isLoadingFull,
  fullEntries,
  onTriggerLoad,
}: DownloadCsvButtonProps) {
  const t = useTranslations('TimeEntry');

  const handleClick = () => {
    if (!fullEntries) {
      onTriggerLoad();
      return;
    }

    const entries = locationFilter
      ? fullEntries.filter(
          (e) => resolveTimeEntryLocation(e) === locationFilter,
        )
      : fullEntries;

    const csv = serializeTimesheetsToCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${orgUnitId}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isLoadingFull}
    >
      {isLoadingFull ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {t('table.downloadCsv')}
    </Button>
  );
}

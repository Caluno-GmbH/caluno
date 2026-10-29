'use client';

import type { GetTimeEntriesQuery } from '@repo/data';
import { Button } from '@repo/ui';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { serializeTimesheetsToCsv } from '@/domain/time-entry/timesheets-csv';
import { triggerDownload } from '@/lib/download/trigger-download';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface DownloadCsvButtonProps {
  orgUnitId: string;
  isLoadingFull: boolean;
  fullEntries: TimeEntry[] | undefined;
  onTriggerLoad: () => void;
}

export function DownloadCsvButton({
  orgUnitId,
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

    const today = new Date().toISOString().slice(0, 10);
    triggerDownload(
      `timesheets-${orgUnitId}-${today}.csv`,
      serializeTimesheetsToCsv(fullEntries),
    );
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

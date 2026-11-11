'use client';

import { type ExportTable, PermissionKey } from '@repo/data';
import { useExportLogs } from '@repo/data/react';
import { Button } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { triggerDownload } from '@/lib/download/trigger-download';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { RequirePermission } from '../require-permission';
import { serializeExportLogToCsv } from './export-log-csv';

function ExportLogLineInner({ tableKind }: { tableKind: ExportTable }) {
  const t = useTranslations('Export');
  const { formatDateTime } = useFormatting();
  const { isFetching, refetch } = useExportLogs(tableKind, { enabled: false });

  const handleDownload = async () => {
    const result = await refetch();
    if (result.error || !result.data) {
      toast.error(t('log.downloadFailed'));
      return;
    }
    const headers = [
      t('log.csvHeaders.timestamp'),
      t('log.csvHeaders.actor'),
      t('log.csvHeaders.table'),
      t('log.csvHeaders.columns'),
      t('log.csvHeaders.rowCount'),
      t('log.csvHeaders.subjectCount'),
      t('log.csvHeaders.subjectIds'),
    ];
    const csv = serializeExportLogToCsv(result.data, headers, (iso) =>
      formatDateTime(new Date(iso)),
    );
    triggerDownload(`export-log-${tableKind.toLowerCase()}.csv`, csv);
  };

  return (
    <div className="flex items-center justify-end pt-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground text-xs"
        disabled={isFetching}
        onClick={handleDownload}
      >
        {t('log.downloadButton')}
      </Button>
    </div>
  );
}

export function ExportLogLine({ tableKind }: { tableKind: ExportTable }) {
  return (
    <RequirePermission permission={PermissionKey.OrgEdit}>
      <ExportLogLineInner tableKind={tableKind} />
    </RequirePermission>
  );
}

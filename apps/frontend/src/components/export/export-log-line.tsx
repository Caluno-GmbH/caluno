'use client';

import { type ExportTable, PermissionKey } from '@repo/data';
import { useExportLogs } from '@repo/data/react';
import { Button } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { triggerDownload } from '@/lib/download/trigger-download';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { RequirePermission } from '../require-permission';
import { serializeExportLogToCsv } from './export-log-csv';

const EXPORT_LOG_LIMIT = 50;

function ExportLogDownloader({
  tableKind,
  onDone,
}: {
  tableKind: ExportTable;
  onDone: () => void;
}) {
  const t = useTranslations('Export');
  const { formatDateTime } = useFormatting();
  const { data, error } = useExportLogs(tableKind, EXPORT_LOG_LIMIT, 0);
  const downloaded = useRef(false);

  useEffect(() => {
    if (downloaded.current) return;
    if (error) {
      downloaded.current = true;
      toast.error(t('log.downloadFailed'));
      onDone();
      return;
    }
    if (!data) return;
    downloaded.current = true;
    const headers = [
      t('log.csvHeaders.timestamp'),
      t('log.csvHeaders.actor'),
      t('log.csvHeaders.table'),
      t('log.csvHeaders.columns'),
      t('log.csvHeaders.rowCount'),
      t('log.csvHeaders.subjectCount'),
      t('log.csvHeaders.subjectIds'),
    ];
    const csv = serializeExportLogToCsv(data, headers, (iso) =>
      formatDateTime(new Date(iso)),
    );
    triggerDownload(`export-log-${tableKind.toLowerCase()}.csv`, csv);
    onDone();
  }, [data, error, t, formatDateTime, tableKind, onDone]);

  return null;
}

function ExportLogLineInner({ tableKind }: { tableKind: ExportTable }) {
  const t = useTranslations('Export');
  const [armed, setArmed] = useState(false);
  const handleDone = useCallback(() => setArmed(false), []);

  return (
    <div className="flex items-center justify-end pt-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground text-xs"
        disabled={armed}
        onClick={() => setArmed(true)}
      >
        {t('log.downloadButton')}
      </Button>
      {armed && (
        <ExportLogDownloader
          tableKind={tableKind}
          onDone={handleDone}
        />
      )}
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

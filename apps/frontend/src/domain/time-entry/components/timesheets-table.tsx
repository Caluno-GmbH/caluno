'use client';

import type { GetTimeEntriesQuery, PaginationInfo } from '@repo/data';
import { TimeEntryStatus } from '@repo/data';
import { useTimeEntriesAll } from '@repo/data/react';
import {
  EntityCell,
  NumberCell,
  TableCell,
  TableRow,
  TextCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import { parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import {
  resolveTimeEntryLocation,
  sumDurationMinutes,
} from '@/domain/time-entry/location';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { serializeTimesheetsToCsv } from '@/domain/time-entry/timesheets-csv';
import { describeRecorder } from '@/domain/time-entry/recorder';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ActionBar } from './action-bar';
import { DownloadCsvButton } from './download-csv-button';
import { TimeEntryStatusBadge } from './time-entry-status-badge';
import { TimesheetsToolbar } from './timesheets-toolbar';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface TimesheetsTableProps {
  entries: TimeEntry[];
  pagination: PaginationInfo;
  organizationUnitId: string;
}

const NO_DURATION = '—';

const getRowClassName = (entry: TimeEntry): string | undefined => {
  switch (entry.status) {
    case TimeEntryStatus.Open:
      return 'bg-muted/80';
    case TimeEntryStatus.AutoClosed:
      return 'bg-alert/10';
    default:
      return undefined;
  }
};

export const TimesheetsTable = ({
  entries,
  pagination,
  organizationUnitId,
}: TimesheetsTableProps) => {
  const t = useTranslations('TimeEntry');
  const { formatWorkedPeriod, formatDuration, formatDurationByMinutes, formatDateTime } =
    useFormatting();

  const [params, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: false,
  });

  const { sort, dir, location, status, shiftId, volunteerId, dateFrom, dateTo } = params;

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  // Full dataset: needed when location filter is active or CSV is triggered
  const [downloadRequested, setDownloadRequested] = useState(false);
  const needsFullDataset = !!(location || downloadRequested);

  const { data: fullEntries, isLoading: isLoadingFull } = useTimeEntriesAll(
    organizationUnitId,
    {
      statuses: status.length > 0 ? status : undefined,
      volunteerId,
      shiftId,
      dateFrom: dateFrom ? dateFrom.toISOString() : null,
      dateTo: dateTo ? dateTo.toISOString() : null,
    },
    needsFullDataset,
  );

  // Derive location options from full dataset
  const locationOptions = useMemo(() => {
    if (!fullEntries) return [];
    const seen = new Set<string>();
    const options: string[] = [];
    for (const entry of fullEntries) {
      const loc = resolveTimeEntryLocation(entry);
      if (loc && !seen.has(loc)) {
        seen.add(loc);
        options.push(loc);
      }
    }
    return options.sort();
  }, [fullEntries]);

  // Apply client-side location filter to the full dataset (for CSV)
  const filteredFull = useMemo(() => {
    if (!fullEntries) return undefined;
    if (!location) return fullEntries;
    return fullEntries.filter((e) => resolveTimeEntryLocation(e) === location);
  }, [fullEntries, location]);

  // Apply client-side location filter to the current page for display
  const displayEntries = useMemo(() => {
    if (!location) return entries;
    return entries.filter((e) => resolveTimeEntryLocation(e) === location);
  }, [entries, location]);

  // Auto-download CSV once full data arrives
  useEffect(() => {
    if (!downloadRequested || !filteredFull) return;
    setDownloadRequested(false);
    const csv = serializeTimesheetsToCsv(filteredFull);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${organizationUnitId}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [downloadRequested, filteredFull, organizationUnitId]);

  const columns = useMemo<ColumnDef<DataTableFeatures, TimeEntry>[]>(
    () => [
      {
        id: 'SHIFT',
        accessorFn: (row) =>
          row.shiftInstance?.master?.title ?? row.organizationUnit?.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.shift')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <Link
              className="block hover:underline"
              href={`/admin/${organizationUnitId}/timesheets/${entry.id}`}
            >
              <TextCell>
                {entry.shiftInstance?.master?.title ??
                  entry.organizationUnit?.name ??
                  t('table.notAvailable')}
              </TextCell>
            </Link>
          );
        },
      },
      {
        id: 'LOCATION',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.location')} />
        ),
        cell: ({ row }) => (
          <TextCell>
            {resolveTimeEntryLocation(row.original) ?? t('table.notAvailable')}
          </TextCell>
        ),
      },
      {
        id: 'VOLUNTEER',
        accessorFn: (row) => row.volunteer?.name ?? row.volunteer?.email,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.volunteer')} />
        ),
        cell: ({ row }) => (
          <TextCell>
            {row.original.volunteer?.name ??
              row.original.volunteer?.email ??
              t('table.notAvailable')}
          </TextCell>
        ),
      },
      {
        id: 'STARTED_AT',
        accessorFn: (row) => row.startedAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.date')} />
        ),
        cell: ({ row }) => {
          const { date, time } = formatWorkedPeriod(
            row.original.startedAt,
            row.original.endedAt,
            t('format.open'),
          );
          return <EntityCell title={date} subtitle={time} />;
        },
      },
      {
        id: 'STATUS',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.status')} />
        ),
        cell: ({ row }) => (
          <TimeEntryStatusBadge status={row.original.status} />
        ),
      },
      {
        id: 'DURATION',
        accessorFn: (row) => row.endedAt,
        meta: { headerClassName: 'text-right' },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.duration')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.status === TimeEntryStatus.Open) {
            return <NumberCell>{NO_DURATION}</NumberCell>;
          }
          const duration = formatDuration(entry.startedAt, entry.endedAt);
          if (entry.status === TimeEntryStatus.AutoClosed) {
            const tooltip = t('status.autoClosedTooltip');
            return (
              <div className="flex justify-end">
                <EntityCell
                  title={duration}
                  trailing={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={tooltip}
                          className="block cursor-default rounded-sm"
                        >
                          <AlertTriangle className="size-4 text-alert" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{tooltip}</TooltipContent>
                    </Tooltip>
                  }
                />
              </div>
            );
          }
          return <NumberCell>{duration}</NumberCell>;
        },
      },
      {
        id: 'CREATED_AT',
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.recorded')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          const recorder = describeRecorder(entry);
          return (
            <EntityCell
              title={formatDateTime(parseISO(entry.createdAt))}
              subtitle={
                recorder.name
                  ? t('table.recordedBy', { name: recorder.name })
                  : t('table.recordedByUnknown')
              }
            />
          );
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        meta: { cellClassName: 'whitespace-nowrap' },
        header: () => null,
        cell: ({ row }) => (
          <ActionBar
            id={row.original.id}
            organizationUnitId={organizationUnitId}
            status={row.original.status}
            size="sm"
          />
        ),
      },
    ],
    [t, formatWorkedPeriod, formatDuration, formatDurationByMinutes, formatDateTime, organizationUnitId],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const totalDurationMinutes = useMemo(
    () => sumDurationMinutes(displayEntries),
    [displayEntries],
  );

  const footerContent = (
    <TableRow className="bg-muted hover:bg-muted font-medium">
      <TableCell colSpan={5} className="text-muted-foreground text-sm">
        {t('table.total')}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatDurationByMinutes(totalDurationMinutes)}
      </TableCell>
      <TableCell colSpan={2} />
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <TimesheetsToolbar
        orgUnitId={organizationUnitId}
        locationOptions={locationOptions}
        isLoadingLocations={needsFullDataset && isLoadingFull}
        actions={[
          <DownloadCsvButton
            key="csv"
            orgUnitId={organizationUnitId}
            locationFilter={location}
            isLoadingFull={isLoadingFull && downloadRequested}
            fullEntries={filteredFull}
            onTriggerLoad={() => setDownloadRequested(true)}
          />,
        ]}
      />
      <DataTable
        columns={columns}
        data={displayEntries}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={t('empty.title')}
        getRowClassName={getRowClassName}
        footerContent={displayEntries.length > 0 ? footerContent : undefined}
      />
      {pagination.total > 0 && (
        <DataTablePagination
          total={pagination.total}
          name={t('page.paginationName')}
        />
      )}
    </div>
  );
};

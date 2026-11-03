'use client';

import type { GetTimeEntriesQuery } from '@repo/data';
import { TimeEntryStatus } from '@repo/data';
import { useTimeEntriesAll } from '@repo/data/react';
import {
  Alert,
  AlertDescription,
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
  Row,
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
  compareEntriesByDuration,
  resolveTimeEntryLocation,
  sumDurationMinutes,
} from '@/domain/time-entry/location';
import { describeRecorder } from '@/domain/time-entry/recorder';
import { serializeTimesheetsToCsv } from '@/domain/time-entry/timesheets-csv';
import { toTimesheetDateRange } from '@/domain/time-entry/timesheets-date-range';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { Link } from '@/i18n/navigation';
import { triggerDownload } from '@/lib/download/trigger-download';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ActionBar } from './action-bar';
import { CopyEmailsButton } from './copy-emails-button';
import { CopyableEmail } from './copyable-email';
import { DownloadCsvButton } from './download-csv-button';
import { TimeEntryStatusBadge } from './time-entry-status-badge';
import { TimesheetsToolbar } from './timesheets-toolbar';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface TimesheetsTableProps {
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
  organizationUnitId,
}: TimesheetsTableProps) => {
  const t = useTranslations('TimeEntry');
  const {
    formatWorkedPeriod,
    formatDurationShort,
    formatDurationByMinutesShort,
    formatDateTime,
  } = useFormatting();

  // All rows are client-side; page/sort writes stay shallow (no server round trip).
  // Filter params (status, shiftId, etc.) still drive the query key, so changing
  // a filter still refetches the full set.
  const [params, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: true,
  });

  const {
    sort,
    dir,
    location,
    status,
    shiftId,
    volunteerId,
    dateFrom,
    dateTo,
  } = params;

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  const [downloadRequested, setDownloadRequested] = useState(false);

  const dateRange = toTimesheetDateRange(dateFrom, dateTo);

  const {
    data: fullData,
    isLoading: isLoadingFull,
    isError,
  } = useTimeEntriesAll(
    organizationUnitId,
    {
      statuses: status.length > 0 ? status : undefined,
      volunteerId,
      shiftId,
      dateFrom: dateRange.dateFrom ?? null,
      dateTo: dateRange.dateTo ?? null,
    },
    true,
  );

  const fullEntries = fullData?.items;
  const truncated = fullData?.truncated ?? false;

  // Omits the shift constraint so every shift stays selectable while one is
  // active; only fetched when a shift filter is in use — otherwise shiftOptions
  // derives from the main dataset to avoid a duplicate full-set request.
  const { data: shiftFilterData } = useTimeEntriesAll(
    organizationUnitId,
    {
      statuses: status.length > 0 ? status : undefined,
      volunteerId,
      shiftId: null,
      dateFrom: dateRange.dateFrom ?? null,
      dateTo: dateRange.dateTo ?? null,
    },
    Boolean(shiftId),
  );

  const fullEntryLocations = useMemo(() => {
    if (!fullEntries) return undefined;
    const map = new Map<TimeEntry, string | null>();
    for (const entry of fullEntries) {
      map.set(entry, resolveTimeEntryLocation(entry));
    }
    return map;
  }, [fullEntries]);

  const locationOptions = useMemo(() => {
    if (!fullEntryLocations) return [];
    const seen = new Set<string>();
    const options: string[] = [];
    for (const loc of fullEntryLocations.values()) {
      if (loc && !seen.has(loc)) {
        seen.add(loc);
        options.push(loc);
      }
    }
    return options.sort();
  }, [fullEntryLocations]);

  const shiftOptions = useMemo(() => {
    const sourceEntries = shiftId ? shiftFilterData?.items : fullEntries;
    if (!sourceEntries) return [];
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const entry of sourceEntries) {
      const master = entry.shiftInstance?.master;
      if (master && !seen.has(master.id)) {
        seen.add(master.id);
        options.push({ label: master.title, value: master.id });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [shiftId, shiftFilterData, fullEntries]);

  // Full filtered set: the single source of truth for table data, pagination, and totals.
  const filteredFull = useMemo(() => {
    if (!fullEntries || !fullEntryLocations) return undefined;
    if (!location) return fullEntries;
    return fullEntries.filter((e) => fullEntryLocations.get(e) === location);
  }, [fullEntries, fullEntryLocations, location]);

  const filteredEmails = useMemo(() => {
    const seen = new Set<string>();
    for (const entry of filteredFull ?? []) {
      if (entry.volunteer?.email) seen.add(entry.volunteer.email);
    }
    return [...seen];
  }, [filteredFull]);

  const hasActiveFilter =
    status.length > 0 ||
    Boolean(shiftId) ||
    Boolean(volunteerId) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(location);

  const canCopyEmails = hasActiveFilter && filteredEmails.length > 0;

  useEffect(() => {
    if (!downloadRequested || !filteredFull) return;
    setDownloadRequested(false);
    const today = new Date().toISOString().slice(0, 10);
    const csvHeaders = [
      t('csv.volunteerName'),
      t('csv.volunteerEmail'),
      t('csv.shift'),
      t('csv.assignment'),
      t('csv.location'),
      t('csv.startedAt'),
      t('csv.endedAt'),
      t('csv.durationMinutes'),
      t('csv.status'),
      t('csv.createdBy'),
      t('csv.notes'),
    ];
    triggerDownload(
      `timesheets-${organizationUnitId}-${today}.csv`,
      serializeTimesheetsToCsv(filteredFull, csvHeaders),
    );
  }, [downloadRequested, filteredFull, organizationUnitId, t]);

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
        meta: { headerClassName: 'w-1/4', cellClassName: 'w-1/4' },
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
        meta: { headerClassName: 'w-1/6', cellClassName: 'w-1/6' },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.volunteer')} />
        ),
        cell: ({ row }) => {
          const volunteer = row.original.volunteer;
          const email = volunteer?.email;
          const copyableEmail = email ? (
            <CopyableEmail email={email} name={volunteer?.name ?? email} />
          ) : undefined;
          return (
            <EntityCell
              title={
                volunteer?.name ?? copyableEmail ?? t('table.notAvailable')
              }
              subtitle={volunteer?.name ? copyableEmail : undefined}
              clamp={false}
            />
          );
        },
      },
      {
        id: 'STARTED_AT',
        accessorFn: (row) => row.startedAt,
        meta: {
          headerClassName: 'w-0 whitespace-nowrap',
          cellClassName: 'w-0 whitespace-nowrap',
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.date')} />
        ),
        cell: ({ row }) => {
          const { date, time } = formatWorkedPeriod(
            row.original.startedAt,
            row.original.endedAt,
            t('format.open'),
          );
          return <EntityCell title={date} subtitle={time} clamp={false} />;
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
        sortFn: (
          rowA: Row<DataTableFeatures, TimeEntry>,
          rowB: Row<DataTableFeatures, TimeEntry>,
          _columnId: string,
        ) => compareEntriesByDuration(rowA.original, rowB.original),
        meta: { headerClassName: 'text-right' },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.duration')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.status === TimeEntryStatus.Open) {
            return <NumberCell>{NO_DURATION}</NumberCell>;
          }
          const duration = formatDurationShort(entry.startedAt, entry.endedAt);
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
    [
      t,
      formatWorkedPeriod,
      formatDurationShort,
      formatDateTime,
      organizationUnitId,
    ],
  );

  const size = Number(params.pageSize);
  const lastPage = Math.max(1, Math.ceil((filteredFull?.length ?? 0) / size));
  const pagination = {
    pageIndex: Math.min(params.page, lastPage) - 1,
    pageSize: size,
  };

  const totalDurationMinutes = useMemo(
    () =>
      filteredFull !== undefined ? sumDurationMinutes(filteredFull) : undefined,
    [filteredFull],
  );

  const durationIndex = columns.findIndex((c) => c.id === 'DURATION');

  const footerContent = (
    <TableRow className="bg-muted hover:bg-muted font-medium">
      <TableCell
        colSpan={durationIndex}
        className="text-muted-foreground text-sm"
      >
        {t('table.total')}
      </TableCell>
      <TableCell className="text-right text-sm">
        {totalDurationMinutes !== undefined
          ? formatDurationByMinutesShort(totalDurationMinutes)
          : NO_DURATION}
      </TableCell>
      <TableCell colSpan={columns.length - durationIndex - 1} />
    </TableRow>
  );

  const emptyMessage = isError
    ? t('table.loadError')
    : isLoadingFull
      ? t('table.loading')
      : t('empty.title');

  return (
    <div className="space-y-4">
      <TimesheetsToolbar
        orgUnitId={organizationUnitId}
        shiftOptions={shiftOptions}
        locationOptions={locationOptions}
        actions={[
          ...(canCopyEmails
            ? [<CopyEmailsButton key="copy-emails" emails={filteredEmails} />]
            : []),
          <DownloadCsvButton
            key="csv"
            orgUnitId={organizationUnitId}
            isLoadingFull={isLoadingFull && downloadRequested}
            fullEntries={filteredFull}
            onTriggerLoad={() => setDownloadRequested(true)}
          />,
        ]}
      />
      {truncated && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>{t('table.truncatedNotice')}</AlertDescription>
        </Alert>
      )}
      <DataTable
        mode="client"
        columns={columns}
        data={filteredFull ?? []}
        sorting={sorting}
        onSortingChange={onSortingChange}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next =
            typeof updater === 'function' ? updater(pagination) : updater;
          void setParams({
            page: next.pageIndex + 1,
            pageSize: String(next.pageSize) as '15' | '25' | '50' | '100',
          });
        }}
        emptyMessage={emptyMessage}
        getRowClassName={getRowClassName}
        footerContent={
          filteredFull && filteredFull.length > 0 ? footerContent : undefined
        }
      />
      {(filteredFull?.length ?? 0) > 0 && (
        <DataTablePagination
          total={filteredFull?.length ?? 0}
          name={t('page.paginationName')}
          shallow
        />
      )}
    </div>
  );
};

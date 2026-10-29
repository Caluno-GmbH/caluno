'use client';

import type { GetTimeEntriesQuery, PaginationInfo } from '@repo/data';
import { TimeEntryStatus } from '@repo/data';
import {
  EntityCell,
  NumberCell,
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
import { useMemo } from 'react';
import { TableCell, TableRow } from '@repo/ui';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import { resolveTimeEntryLocation, sumDurationMinutes } from '@/domain/time-entry/location';
import { describeRecorder } from '@/domain/time-entry/recorder';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { TimesheetsToolbar } from './timesheets-toolbar';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ActionBar } from './action-bar';
import { TimeEntryStatusBadge } from './time-entry-status-badge';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface TimesheetsTableProps {
  entries: TimeEntry[];
  pagination: PaginationInfo;
  organizationUnitId: string;
}

/** Shown instead of a duration for entries that are still running. */
const NO_DURATION = '—';

const getRowClassName = (entry: TimeEntry) => {
  switch (entry.status) {
    case TimeEntryStatus.Open:
      return 'bg-muted/80';
    case TimeEntryStatus.AutoClosed:
      return 'bg-alert/30';
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

  const [{ sort, dir }, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: false,
  });

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

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
        // Matches NumberCell's right alignment.
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
                    // A native button: keyboard-focusable (a div with tabIndex
                    // trips the a11y lint) and named for screen readers.
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
        meta: {
          cellClassName: 'whitespace-nowrap',
        },
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
    [t, formatWorkedPeriod, formatDuration, formatDateTime, organizationUnitId],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const totalDurationMinutes = useMemo(
    () => sumDurationMinutes(entries),
    [entries],
  );

  const footerContent = (
    <TableRow className="bg-muted hover:bg-muted font-medium">
      {/* Span SHIFT + LOCATION + VOLUNTEER + STARTED_AT + STATUS = 5 cols */}
      <TableCell colSpan={5} className="text-muted-foreground text-sm">
        {t('table.total')}
      </TableCell>
      {/* DURATION column */}
      <TableCell className="text-right text-sm">
        {formatDurationByMinutes(totalDurationMinutes)}
      </TableCell>
      {/* CREATED_AT + actions = 2 cols */}
      <TableCell colSpan={2} />
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <TimesheetsToolbar
        orgUnitId={organizationUnitId}
        locationOptions={[]}
      />
      <DataTable
        columns={columns}
        data={entries}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={t('empty.title')}
        getRowClassName={getRowClassName}
        footerContent={entries.length > 0 ? footerContent : undefined}
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

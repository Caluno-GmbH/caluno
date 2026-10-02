'use client';

import type { GetTimeEntriesQuery, PaginationInfo } from '@repo/data';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import { parseISO } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import { Pagination } from '@/components/pagination';
import { describeRecorder } from '@/domain/time-entry/recorder';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ActionBar } from './action-bar';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];

interface TimesheetsTableProps {
  entries: TimeEntry[];
  pagination: PaginationInfo;
  organizationUnitId: string;
}

export const TimesheetsTable = ({
  entries,
  pagination,
  organizationUnitId,
}: TimesheetsTableProps) => {
  const t = useTranslations('TimeEntry');
  const { formatWorkedPeriod, formatDuration, formatDateTime } =
    useFormatting();
  const searchParams = useSearchParams();

  const [{ sort, dir, page }, setParams] = useQueryStates(
    timesheetsSearchParams,
    { shallow: false },
  );

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  const columns = useMemo<ColumnDef<TimeEntry>[]>(
    () => [
      {
        id: 'SHIFT',
        meta: { headerClassName: 'w-[17%]' },
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
              {entry.shiftInstance?.master?.title ??
                entry.organizationUnit?.name ??
                t('table.notAvailable')}
            </Link>
          );
        },
      },
      {
        id: 'VOLUNTEER',
        meta: { headerClassName: 'w-[15%]' },
        accessorFn: (row) => row.volunteer?.name ?? row.volunteer?.email,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.volunteer')} />
        ),
        cell: ({ row }) =>
          row.original.volunteer?.name ??
          row.original.volunteer?.email ??
          t('table.notAvailable'),
      },
      {
        id: 'STARTED_AT',
        meta: { headerClassName: 'w-[19%]' },
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
          return (
            <div className="flex flex-col">
              <span>{date}</span>
              <span className="text-muted-foreground text-xs">{time}</span>
            </div>
          );
        },
      },
      {
        id: 'DURATION',
        meta: { headerClassName: 'w-[12%]' },
        accessorFn: (row) => row.endedAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.duration')} />
        ),
        cell: ({ row }) =>
          formatDuration(row.original.startedAt, row.original.endedAt),
      },
      {
        id: 'CREATED_AT',
        meta: { headerClassName: 'w-[27%]' },
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.recorded')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          const recorder = describeRecorder(entry);
          return (
            <div className="flex flex-col">
              <span>{formatDateTime(parseISO(entry.createdAt))}</span>
              <span className="text-muted-foreground text-xs">
                {recorder.name
                  ? t('table.recordedBy', { name: recorder.name })
                  : t('table.recordedByUnknown')}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        meta: {
          headerClassName: 'w-[10%]',
          cellClassName: 'whitespace-nowrap',
        },
        header: () => null,
        cell: ({ row }) => (
          <ActionBar
            id={row.original.id}
            organizationUnitId={organizationUnitId}
            size="xs"
          />
        ),
      },
    ],
    [t, formatWorkedPeriod, formatDuration, formatDateTime, organizationUnitId],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={entries}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={t('empty.title')}
        getRowClassName={(entry) => (entry.endedAt ? undefined : 'bg-muted/80')}
      />
      {pagination.total > pagination.limit && (
        <Pagination
          pagination={pagination}
          url={`/admin/${organizationUnitId}/timesheets?${searchParams.toString()}`}
          currentPage={page}
          name={t('page.paginationName')}
        />
      )}
    </div>
  );
};

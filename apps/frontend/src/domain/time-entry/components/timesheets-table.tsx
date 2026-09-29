'use client';

import type {
  GetTimeEntriesQuery,
  PaginationInfo,
  TimeEntrySortField,
} from '@repo/data';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import { Pagination } from '@/components/pagination';
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
  const { formatRange, formatDuration, formatDateTime } = useFormatting();
  const searchParams = useSearchParams();

  const [{ sort, dir, page }, setParams] = useQueryStates(
    timesheetsSearchParams,
    { shallow: false },
  );

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({
      ...resolved,
      sort: resolved.sort as TimeEntrySortField,
      page: 1,
    });
  };

  const columns = useMemo<ColumnDef<TimeEntry>[]>(
    () => [
      {
        id: 'SHIFT',
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.time')} />
        ),
        cell: ({ row }) =>
          formatRange(
            row.original.startedAt,
            row.original.endedAt,
            t('format.open'),
          ),
      },
      {
        id: 'DURATION',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.duration')} />
        ),
        cell: ({ row }) =>
          formatDuration(row.original.startedAt, row.original.endedAt),
      },
      {
        id: 'CREATED_AT',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.recorded')} />
        ),
        cell: ({ row }) => {
          const entry = row.original;
          const recorder = entry.createdBy
            ? (entry.createdBy.name ?? entry.createdBy.email)
            : null;
          const onBehalf =
            entry.createdBy && entry.createdBy.id !== entry.volunteer?.id;
          return (
            <div className="flex flex-col">
              <span>{formatDateTime(new Date(entry.createdAt))}</span>
              <span className="text-muted-foreground text-xs">
                {recorder
                  ? t('table.recordedBy', { name: recorder })
                  : t('table.recordedByUnknown')}
                {onBehalf ? ` · ${t('table.recordedOnBehalf')}` : ''}
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        enableSorting: false,
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
    [t, formatRange, formatDuration, formatDateTime, organizationUnitId],
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

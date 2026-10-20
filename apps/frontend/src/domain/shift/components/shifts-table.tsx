'use client';

import type { GetShiftsQuery, PaginationInfo } from '@repo/data';
import { formatRrulePattern } from '@repo/data';
import {
  ActionsCell,
  Badge,
  Button,
  Input,
  StatusCell,
  TextCell,
} from '@repo/ui';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import {
  eventShiftEditPath,
  eventShiftInvitePath,
} from '@/domain/event/routes';
import { getVisibilityConfig } from '@/domain/shift/lib/shift-badge-config';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { shiftDetailPath, shiftEditPath } from '../routes';
import { shiftsSearchParams } from '../shifts-search-params';
import { ActionBar } from './action-bar';
import { PauschaleMarker } from './pauschale-marker';

type ShiftListItem = GetShiftsQuery['shifts']['items'][number] & {
  instance?: { id: string } | null;
};

interface ShiftsTableProps {
  shifts: ShiftListItem[];
  pagination: PaginationInfo;
  orgUId: string;
  page?: number;
  eventId?: string;
}

export function ShiftsTable({
  shifts,
  pagination,
  orgUId,
  page,
  eventId,
}: ShiftsTableProps) {
  const t = useTranslations('Shift');
  const { formatDate, formatTimeRange } = useFormatting();

  const [{ sort, dir, q }, setParams] = useQueryStates(shiftsSearchParams, {
    shallow: false,
  });

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  const visibilityConfig = getVisibilityConfig(t);

  const columns = useMemo<ColumnDef<DataTableFeatures, ShiftListItem>[]>(
    () => [
      {
        id: 'TITLE',
        accessorFn: (row) => row.title,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.name')} />
        ),
        cell: ({ row }) => {
          const shift = row.original;
          return (
            <div className="flex min-w-0 items-center gap-1.5">
              <Link
                className="hover:underline truncate"
                href={shiftDetailPath(orgUId, shift.id, {
                  view: 'shifts',
                  ...(page && page > 1 ? { page: String(page) } : {}),
                })}
              >
                {shift.title}
              </Link>
              <PauschaleMarker
                reimbursementTypeId={shift.reimbursementTypeId}
              />
            </div>
          );
        },
      },
      {
        id: 'FIRST_DATE',
        accessorFn: (row) => row.originalStartsAt,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.firstDate')} />
        ),
        cell: ({ row }) => {
          const startDate = new Date(row.original.originalStartsAt);
          return <TextCell>{formatDate(startDate)}</TextCell>;
        },
      },
      {
        id: 'pattern',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.pattern')} />
        ),
        cell: ({ row }) => (
          <StatusCell>
            <Badge variant="outline">
              {formatRrulePattern(row.original.rrule)}
            </Badge>
          </StatusCell>
        ),
      },
      {
        id: 'time',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.time')} />
        ),
        cell: ({ row }) => {
          const startDate = new Date(row.original.originalStartsAt);
          const endDate = new Date(
            startDate.getTime() + row.original.durationMinutes * 60000,
          );
          return <TextCell>{formatTimeRange(startDate, endDate)}</TextCell>;
        },
      },
      {
        id: 'VISIBILITY',
        accessorFn: (row) => row.visibility,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('table.visibility')}
          />
        ),
        cell: ({ row }) => {
          const cfg = visibilityConfig[row.original.visibility];
          return (
            <StatusCell>
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </StatusCell>
          );
        },
      },
      {
        id: 'forms',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('table.requiredForms')}
          />
        ),
        cell: ({ row }) => (
          <StatusCell>
            <Badge variant="outline">{row.original.requiredFormsCount}</Badge>
          </StatusCell>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const shift = row.original;
          return (
            <ActionsCell>
              <ActionBar
                organizationUnitId={orgUId}
                id={shift.id}
                size="sm"
                editHref={
                  eventId
                    ? eventShiftEditPath(orgUId, eventId, shift.id)
                    : shiftEditPath(orgUId, shift.id)
                }
                inviteHref={
                  eventId && shift.instance
                    ? eventShiftInvitePath(
                        orgUId,
                        eventId,
                        shift.id,
                        shift.instance.id,
                      )
                    : undefined
                }
              />
            </ActionsCell>
          );
        },
      },
    ],
    [t, orgUId, page, eventId, formatDate, formatTimeRange, visibilityConfig],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          value={q}
          onChange={(e) => {
            void setParams({ q: e.target.value, page: 1 });
          }}
          placeholder={t('search.placeholder')}
          className="pl-9 pr-10"
        />
        {q && (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => void setParams({ q: '', page: 1 })}
            tooltip={t('search.clearAria')}
            className="absolute top-2 right-2"
          >
            <X />
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={shifts}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={t('empty.title')}
      />
      {pagination.total > 0 && (
        <DataTablePagination total={pagination.total} name={t('page.title')} />
      )}
    </div>
  );
}

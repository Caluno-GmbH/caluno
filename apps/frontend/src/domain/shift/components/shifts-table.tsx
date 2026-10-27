'use client';

import type { GetShiftsQuery, PaginationInfo } from '@repo/data';
import { formatRrulePattern } from '@repo/data';
import { useReimbursementTypes } from '@repo/data/react';
import {
  ActionTooltip,
  Badge,
  Button,
  cn,
  EntityCell,
  Input,
  StatusCell,
  TextCell,
} from '@repo/ui';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  HeartHandshake,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { debounce, useQueryStates } from 'nuqs';
import { type CSSProperties, type ElementType, useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { SEARCH_DEBOUNCE_MS } from '@/components/data-table/table-params';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import { TYPE_COLOR } from '@/domain/accounting/components/doc-type-header';
import { eventShiftEditPath } from '@/domain/event/routes';
import { getVisibilityConfig } from '@/domain/shift/lib/shift-badge-config';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { resolvePauschaleMarker } from '../pauschale-marker';
import { shiftDetailPath, shiftEditPath } from '../routes';
import { shiftsSearchParams } from '../shifts-search-params';
import { getStaffingState, staffingBadgeText } from '../staffing';
import { ActionBar } from './action-bar';

type ApiShiftItem = GetShiftsQuery['shifts']['items'][number];
type ApiInstanceItem = ApiShiftItem['instances'][number];

export interface ShiftInstanceRow {
  kind: 'instance';
  id: string;
  masterId: string;
  actualStartsAt: string;
  actualEndsAt: string;
  isCancelled: boolean;
  resolvedLocation: string | null;
  resolvedMin: number | null;
  resolvedMax: number | null;
  filledCount: number;
  pendingCount: number;
  /** Whether location is inherited (no override) */
  locationInherited: boolean;
}

export interface ShiftMasterRow {
  kind: 'master';
  id: string;
  title: string;
  rrule: string | null;
  originalStartsAt: string;
  durationMinutes: number;
  visibility: ApiShiftItem['visibility'];
  location: string | null;
  minVolunteers: number | null;
  maxVolunteers: number | null;
  reimbursementTypeId: string | null;
  subRows: ShiftInstanceRow[];
}

export type ShiftRow = ShiftMasterRow | ShiftInstanceRow;

function toInstanceRow(
  inst: ApiInstanceItem,
  master: ApiShiftItem,
): ShiftInstanceRow {
  return {
    kind: 'instance',
    id: inst.id,
    masterId: master.id,
    actualStartsAt: inst.actualStartsAt,
    actualEndsAt: inst.actualEndsAt,
    isCancelled: inst.isCancelled,
    resolvedLocation: inst.overrideLocation ?? master.location,
    resolvedMin: inst.overrideMinVolunteers ?? master.minVolunteers,
    resolvedMax: inst.overrideMaxVolunteers ?? master.maxVolunteers,
    filledCount: inst.filledCount,
    pendingCount: inst.pendingCount,
    locationInherited: inst.overrideLocation == null,
  };
}

function toMasterRow(item: ApiShiftItem): ShiftMasterRow {
  return {
    kind: 'master',
    id: item.id,
    title: item.title,
    rrule: item.rrule,
    originalStartsAt: item.originalStartsAt,
    durationMinutes: item.durationMinutes,
    visibility: item.visibility,
    location: item.location,
    minVolunteers: item.minVolunteers,
    maxVolunteers: item.maxVolunteers,
    reimbursementTypeId: item.reimbursementTypeId,
    subRows: item.instances.map((inst) => toInstanceRow(inst, item)),
  };
}

interface ShiftsTableProps {
  shifts: ApiShiftItem[];
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

  const [{ sort, dir, q, pageSize }, setParams] = useQueryStates(
    shiftsSearchParams,
    { shallow: false },
  );

  const returnQuery = useMemo(() => {
    const defaults = shiftsSearchParams;
    return {
      view: 'shifts' as const,
      ...(page && page > 1 ? { page: String(page) } : {}),
      ...(pageSize !== defaults.pageSize.defaultValue ? { pageSize } : {}),
      ...(sort !== defaults.sort.defaultValue ? { sort } : {}),
      ...(dir !== defaults.dir.defaultValue ? { dir } : {}),
      ...(q.trim() ? { q } : {}),
    };
  }, [page, pageSize, sort, dir, q]);

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  const visibilityConfig = useMemo(() => getVisibilityConfig(t), [t]);

  const { data: reimbursementTypes } = useReimbursementTypes();

  // Icon components for the Name EntityCell: the paid Pauschale type (coloured)
  // or a muted calendar for unpaid shifts, each with an explanatory tooltip.
  const nameIcons = useMemo(() => {
    const make =
      (
        Icon: ElementType,
        label: string,
        style?: CSSProperties,
        extraClass?: string,
      ) =>
      ({ className }: { className?: string }) => (
        <ActionTooltip label={label}>
          <Icon
            role="img"
            aria-label={label}
            className={cn(className, extraClass)}
            style={style}
          />
        </ActionTooltip>
      );
    return {
      ehrenamt: make(HeartHandshake, t('paidMarker.ehrenamt'), {
        color: TYPE_COLOR.ehrenamt,
      }),
      uebungsleiter: make(GraduationCap, t('paidMarker.uebungsleiter'), {
        color: TYPE_COLOR.uebungsleiter,
      }),
      unpaid: make(
        Calendar,
        t('paidMarker.unpaid'),
        undefined,
        'text-muted-foreground',
      ),
    };
  }, [t]);

  const masterRows = useMemo(() => shifts.map(toMasterRow), [shifts]);

  const columns = useMemo<ColumnDef<DataTableFeatures, ShiftRow>[]>(
    () => [
      {
        id: 'TITLE',
        accessorFn: (row) =>
          row.kind === 'master' ? row.title : row.actualStartsAt,
        meta: {
          headerClassName: 'w-[30%]',
          cellClassName: 'w-[30%]',
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.name')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind === 'master') {
            const marker = resolvePauschaleMarker(
              item.reimbursementTypeId,
              reimbursementTypes,
            );
            const NameIcon = marker ? nameIcons[marker] : nameIcons.unpaid;
            return (
              <div className="flex min-w-0 items-center gap-1">
                {row.getCanExpand() && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={row.getToggleExpandedHandler()}
                    className="shrink-0"
                  >
                    {row.getIsExpanded() ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                )}
                <EntityCell
                  icon={NameIcon}
                  title={
                    <Link
                      className="hover:underline"
                      href={shiftDetailPath(orgUId, item.id, returnQuery)}
                    >
                      {item.title}
                    </Link>
                  }
                />
              </div>
            );
          }
          return (
            <TextCell className="pl-6 text-muted-foreground">
              {formatDate(new Date(item.actualStartsAt))}
            </TextCell>
          );
        },
      },
      {
        id: 'FIRST_DATE',
        enableSorting: false,
        meta: {
          headerClassName: 'w-[12%]',
          cellClassName: 'w-[12%]',
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.time')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind === 'master') {
            return (
              <StatusCell>
                <Badge variant="outline">
                  {formatRrulePattern(item.rrule)}
                </Badge>
              </StatusCell>
            );
          }
          const start = new Date(item.actualStartsAt);
          const end = new Date(item.actualEndsAt);
          return <TextCell>{formatTimeRange(start, end)}</TextCell>;
        },
      },
      {
        id: 'location',
        enableSorting: false,
        meta: {
          headerClassName: 'w-[28%]',
          cellClassName: 'w-[28%]',
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.location')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind === 'master') {
            return <TextCell>{item.location ?? ''}</TextCell>;
          }
          return (
            <TextCell
              className={
                item.locationInherited ? 'text-muted-foreground' : undefined
              }
            >
              {item.resolvedLocation ?? ''}
            </TextCell>
          );
        },
      },
      {
        id: 'staffing',
        enableSorting: false,
        meta: {
          headerClassName: 'w-[10%]',
          cellClassName: 'w-[10%]',
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.staffing')} />
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind !== 'instance') {
            return null;
          }
          const {
            resolvedMin: min,
            resolvedMax: max,
            filledCount: count,
          } = item;
          const state = getStaffingState(count, min, max);
          const variant =
            state === 'full'
              ? 'success'
              : state === 'alert'
                ? 'alert'
                : 'outline';
          const belowMin =
            state === 'alert' && min != null && count > 0 && count < min;
          const Icon = belowMin ? TriangleAlert : UsersRound;
          return (
            <StatusCell>
              <Badge variant={variant} className="gap-1">
                <Icon className="size-3.5" />
                {staffingBadgeText(count, min, max, state)}
              </Badge>
              {item.pendingCount > 0 && (
                <Badge variant="neutral" className="gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {item.pendingCount}
                </Badge>
              )}
            </StatusCell>
          );
        },
      },
      {
        id: 'VISIBILITY',
        accessorFn: (row) =>
          row.kind === 'master' ? row.visibility : undefined,
        meta: {
          headerClassName: 'w-[10%]',
          cellClassName: 'w-[10%]',
        },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('table.visibility')}
          />
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind !== 'master') {
            return null;
          }
          const cfg = visibilityConfig[item.visibility];
          return (
            <StatusCell>
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </StatusCell>
          );
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        meta: {
          headerClassName: 'w-[10%]',
          cellClassName: 'w-[10%]',
        },
        header: () => null,
        cell: ({ row }) => {
          const item = row.original;
          if (item.kind !== 'master') {
            return null;
          }
          return (
            <ActionBar
              organizationUnitId={orgUId}
              id={item.id}
              size="sm"
              editHref={
                eventId
                  ? eventShiftEditPath(orgUId, eventId, item.id)
                  : shiftEditPath(orgUId, item.id)
              }
              inviteHref={undefined}
            />
          );
        },
      },
    ],
    [
      t,
      orgUId,
      returnQuery,
      eventId,
      formatDate,
      formatTimeRange,
      visibilityConfig,
      reimbursementTypes,
      nameIcons,
    ],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          value={q}
          onChange={(e) => {
            void setParams(
              { q: e.target.value, page: 1 },
              { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) },
            );
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
        data={masterRows}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={q.trim() ? t('search.noResults') : t('empty.title')}
        expansion={{
          getSubRows: (r) => (r.kind === 'master' ? r.subRows : undefined),
          defaultAllExpanded: true,
        }}
      />
      {pagination.total > 0 && (
        <DataTablePagination
          total={pagination.total}
          name={t('page.paginationName')}
        />
      )}
    </div>
  );
}

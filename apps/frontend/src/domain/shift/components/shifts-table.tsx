'use client';

import { tz } from '@date-fns/tz';
import type { GetShiftsQuery, PaginationInfo } from '@repo/data';
import {
  formatRrulePattern,
  isSingleOccurrenceRrule,
  parseRruleEndDate,
  ShiftVisibility,
} from '@repo/data';
import { useReimbursementTypes } from '@repo/data/react';
import {
  ActionTooltip,
  Badge,
  Button,
  EntityCell,
  StatusCell,
  TableToolbar,
  TextCell,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import type {
  ColumnDef,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import { addDays, startOfDay } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  HeartHandshake,
  MapPin,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { debounce, useQueryStates } from 'nuqs';
import { type ElementType, useCallback, useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { SEARCH_DEBOUNCE_MS } from '@/components/data-table/table-params';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import { TYPE_COLOR } from '@/domain/accounting/components/doc-type-header';
import { eventShiftEditPath } from '@/domain/event/routes';
import type { ShiftFilterField } from '@/domain/shift/lib/shift-active-filters';
import { buildShiftActiveFilters } from '@/domain/shift/lib/shift-active-filters';
import { getVisibilityConfig } from '@/domain/shift/lib/shift-badge-config';
import { applyFillFilter } from '@/domain/shift/lib/shift-fill-filter';
import { Link } from '@/i18n/navigation';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { resolvePauschaleMarker } from '../pauschale-marker';
import {
  shiftDetailPath,
  shiftEditPath,
  shiftInstanceDetailPath,
} from '../routes';
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
  /** True for single-occurrence shifts: rendered as one row with no sub-rows. */
  isOneOff: boolean;
  /** The sole instance of a one-off shift, surfaced on the master row itself. */
  singleInstance: ShiftInstanceRow | null;
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
  const instances = item.instances.map((inst) => toInstanceRow(inst, item));
  const isOneOff = isSingleOccurrenceRrule(item.rrule);
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
    isOneOff,
    singleInstance: isOneOff ? (instances[0] ?? null) : null,
    // A one-off shift is one row: no instance sub-rows underneath.
    subRows: isOneOff ? [] : instances,
  };
}

/** Tints the whole row when its (resolved) staffing is understaffed. */
function getRowClassName(row: ShiftRow): string | undefined {
  const instance = row.kind === 'instance' ? row : row.singleInstance;
  if (
    instance &&
    getStaffingState(
      instance.filledCount,
      instance.resolvedMin,
      instance.resolvedMax,
    ) === 'alert'
  ) {
    return 'bg-alert/5';
  }
  return undefined;
}

interface ShiftsTableProps {
  shifts: ApiShiftItem[];
  pagination: PaginationInfo;
  orgUId: string;
  page?: number;
  eventId?: string;
  locationOptions: string[];
}

export function ShiftsTable({
  shifts,
  pagination,
  orgUId,
  page,
  eventId,
  locationOptions,
}: ShiftsTableProps) {
  const t = useTranslations('Shift');
  const { formatDate, formatTimeRange, formatDateRange } = useFormatting();

  const [
    { sort, dir, q, pageSize, location, visibility, dateFrom, dateTo, fill },
    setParams,
  ] = useQueryStates(shiftsSearchParams, { shallow: false });

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

  // Trailing Pauschale marker for the Name cell: the paid type's coloured icon
  // with an explanatory tooltip. Unpaid shifts show no icon.
  const pauschaleTrailing = useMemo(() => {
    const make = (Icon: ElementType, label: string, color: string) => (
      <ActionTooltip label={label}>
        <Icon
          role="img"
          aria-label={label}
          className="size-8"
          style={{ color }}
        />
      </ActionTooltip>
    );
    return {
      ehrenamt: make(
        HeartHandshake,
        t('paidMarker.ehrenamt'),
        TYPE_COLOR.ehrenamt,
      ),
      uebungsleiter: make(
        GraduationCap,
        t('paidMarker.uebungsleiter'),
        TYPE_COLOR.uebungsleiter,
      ),
    };
  }, [t]);

  const masterRows = useMemo(() => shifts.map(toMasterRow), [shifts]);

  // The backend windows the list to today → +31 days when no date filter is set.
  // Surface that default in the picker so it isn't a silent filter.
  const defaultWindow = useMemo(() => {
    const appTz = { in: tz(DEFAULT_TIMEZONE) };
    const from = startOfDay(new Date(), appTz);
    return { from, to: addDays(from, 31, appTz) };
  }, []);

  const visibleRows = useMemo(
    () => applyFillFilter(masterRows, fill),
    [masterRows, fill],
  );

  // Instance rows and one-off masters link to the assignment (instance) detail;
  // a recurring master's header row links to the full shift detail.
  const getRowHref = useCallback(
    (row: ShiftRow): string => {
      if (row.kind === 'instance') {
        return shiftInstanceDetailPath(
          orgUId,
          row.masterId,
          row.id,
          returnQuery,
        );
      }
      if (row.singleInstance) {
        return shiftInstanceDetailPath(
          orgUId,
          row.id,
          row.singleInstance.id,
          returnQuery,
        );
      }
      return shiftDetailPath(orgUId, row.id, returnQuery);
    },
    [orgUId, returnQuery],
  );

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
            let subtitle: string;
            if (item.singleInstance) {
              // One-off: the single occurrence's date.
              subtitle = formatDate(
                new Date(item.singleInstance.actualStartsAt),
              );
            } else {
              // Recurring: the start→end span, or "Since <start>" when open-ended.
              const start = new Date(item.originalStartsAt);
              const end = parseRruleEndDate(item.rrule);
              subtitle = end
                ? formatDateRange(start, end)
                : t('table.recurrenceSince', { date: formatDate(start) });
            }
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
                  className="flex-1 justify-between"
                  title={
                    <Link className="hover:underline" href={getRowHref(item)}>
                      {item.title}
                    </Link>
                  }
                  subtitle={subtitle}
                  trailing={marker ? pauschaleTrailing[marker] : undefined}
                />
              </div>
            );
          }
          return (
            <Link className="block hover:underline" href={getRowHref(item)}>
              <TextCell className="pl-6 text-muted-foreground">
                {formatDate(new Date(item.actualStartsAt))}
              </TextCell>
            </Link>
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
          const instance =
            item.kind === 'instance' ? item : item.singleInstance;
          if (item.kind === 'master' && !instance) {
            return (
              <StatusCell>
                <Badge variant="outline">
                  {formatRrulePattern(item.rrule)}
                </Badge>
              </StatusCell>
            );
          }
          if (!instance) {
            return null;
          }
          const start = new Date(instance.actualStartsAt);
          const end = new Date(instance.actualEndsAt);
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
            // A one-off surfaces its instance's resolved (possibly overridden)
            // location; a recurring master shows its own base location.
            if (item.singleInstance) {
              return (
                <TextCell
                  className={
                    item.singleInstance.locationInherited
                      ? 'text-muted-foreground'
                      : undefined
                  }
                >
                  {item.singleInstance.resolvedLocation ?? ''}
                </TextCell>
              );
            }
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
          const instance =
            item.kind === 'instance' ? item : item.singleInstance;
          if (!instance) {
            return null;
          }
          const {
            resolvedMin: min,
            resolvedMax: max,
            filledCount: count,
          } = instance;
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
              {instance.pendingCount > 0 && (
                <Badge variant="neutral" className="gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {instance.pendingCount}
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
      eventId,
      getRowHref,
      formatDate,
      formatTimeRange,
      formatDateRange,
      visibilityConfig,
      reimbursementTypes,
      pauschaleTrailing,
    ],
  );

  const filterLabels = useMemo(
    () => ({
      q: t('search.placeholder'),
      location: t('filter.location'),
      visibility: t('filter.visibility'),
      date: t('filter.date'),
      fill: t('filter.fill'),
    }),
    [t],
  );

  const formatActiveDateRange = (
    from: Date | null,
    to: Date | null,
  ): string => {
    if (from && to) return formatDateRange(from, to);
    if (from) return formatDate(from);
    if (to) return formatDate(to);
    return '';
  };

  const displayVisibility = (v: ShiftVisibility) => visibilityConfig[v].label;

  const displayFill = (f: 'below' | 'full') =>
    ({
      below: t('filter.fillUnderstaffed'),
      full: t('filter.fillFull'),
    })[f];

  const onClearField = (field: ShiftFilterField) => {
    if (field === 'fill') {
      void setParams({ fill: '' }, { shallow: true });
    } else if (field === 'q') {
      void setParams({ q: '', page: 1 });
    } else if (field === 'location') {
      void setParams({ location: '', page: 1 });
    } else if (field === 'visibility') {
      void setParams({ visibility: null, page: 1 });
    } else if (field === 'date') {
      void setParams({ dateFrom: null, dateTo: null, page: 1 });
    }
  };

  const activeFilters = buildShiftActiveFilters({
    values: { q, location, visibility, dateFrom, dateTo, fill },
    labels: filterLabels,
    formatDateRange: formatActiveDateRange,
    displayVisibility,
    displayFill,
    onClear: onClearField,
  });

  const onClearAll = () => {
    void setParams({ fill: '' }, { shallow: true });
    void setParams({ q: '', location: '', visibility: null, dateFrom: null, dateTo: null, page: 1 });
  };

  const filtersActive = activeFilters.length > 0;

  const emptyState = filtersActive ? (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="space-y-1 text-center">
        <p className="font-medium text-foreground">{t('empty.noMatchTitle')}</p>
        <p className="text-muted-foreground text-sm">
          {t('empty.noMatchDescription')}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onClearAll}>
        {t('empty.clearFilters')}
      </Button>
    </div>
  ) : (
    t('empty.title')
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="space-y-4">
      <TableToolbar
        activeFilters={activeFilters}
        onClearAll={onClearAll}
        resultCount={pagination.total}
        sheetTitle={t('filter.sheetTitle')}
      >
        <TableToolbar.Search
          value={q}
          onChange={(v) => {
            void setParams(
              { q: v, page: 1 },
              { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) },
            );
          }}
          placeholder={t('search.placeholder')}
        />
        <TableToolbar.DateRange
          value={{
            from: dateFrom ?? defaultWindow.from,
            to: dateTo ?? defaultWindow.to,
          }}
          onChange={(v) => {
            void setParams({
              dateFrom: v.from ?? null,
              dateTo: v.to ?? null,
              page: 1,
            });
          }}
          placeholder={t('filter.datePlaceholder')}
        />
        <TableToolbar.Combobox
          value={location || undefined}
          onChange={(v) => void setParams({ location: v, page: 1 })}
          options={locationOptions}
          placeholder={t('filter.locationPlaceholder')}
          emptyText={t('filter.locationEmpty')}
          ariaLabel={t('filter.location')}
          icon={<MapPin />}
        />
        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          spacing={0}
          value={visibility ?? 'all'}
          onValueChange={(v) => {
            if (!v) return;
            void setParams({
              visibility: v === 'all' ? null : (v as ShiftVisibility),
              page: 1,
            });
          }}
          aria-label={t('filter.visibility')}
        >
          <ToggleGroupItem value="all">
            {t('filter.visibilityAll')}
          </ToggleGroupItem>
          <ToggleGroupItem value={ShiftVisibility.InvitedMembers}>
            {t('filter.visibilityInviteOnly')}
          </ToggleGroupItem>
          <ToggleGroupItem value={ShiftVisibility.AllMembers}>
            {t('filter.visibilityOpen')}
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          spacing={0}
          value={fill === 'below' || fill === 'full' ? fill : 'all'}
          onValueChange={(v) => {
            if (!v) return;
            void setParams(
              { fill: v === 'all' ? '' : (v as 'below' | 'full') },
              { shallow: true },
            );
          }}
          aria-label={t('filter.fill')}
        >
          <ToggleGroupItem value="all">{t('filter.fillAll')}</ToggleGroupItem>
          <ToggleGroupItem value="below">
            {t('filter.fillUnderstaffed')}
          </ToggleGroupItem>
          <ToggleGroupItem value="full">{t('filter.fillFull')}</ToggleGroupItem>
        </ToggleGroup>
      </TableToolbar>
      <DataTable
        columns={columns}
        data={visibleRows}
        pageCount={pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={emptyState}
        getRowClassName={getRowClassName}
        getRowHref={getRowHref}
        expansion={{
          getSubRows: (r) => (r.kind === 'master' ? r.subRows : undefined),
          defaultAllExpanded: true,
        }}
      />
      {pagination.total > 0 && visibleRows.length > 0 && (
        <DataTablePagination
          total={pagination.total}
          name={t('page.paginationName')}
        />
      )}
    </div>
  );
}

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
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import {
  resolveTimeEntryLocation,
  sumDurationMinutes,
} from '@/domain/time-entry/location';
import {
  groupByAssignment,
  groupByVolunteer,
  type TimesheetAssignmentGroup,
  type TimesheetGroupRow,
  type TimesheetVolunteerGroup,
} from '@/domain/time-entry/timesheets-grouping';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { describeRecorder } from '@/domain/time-entry/recorder';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ActionBar } from './action-bar';
import { TimeEntryStatusBadge } from './time-entry-status-badge';
import { TimesheetsToolbar } from './timesheets-toolbar';

type TimeEntry = GetTimeEntriesQuery['timeEntries']['items'][number];
export type TimesheetRow = TimeEntry | TimesheetGroupRow;

interface TimesheetsTableProps {
  entries: TimeEntry[];
  pagination: PaginationInfo;
  organizationUnitId: string;
}

const NO_DURATION = '—';

const isGroupRow = (row: TimesheetRow): row is TimesheetGroupRow =>
  'kind' in row;
const isVolunteerGroup = (row: TimesheetRow): row is TimesheetVolunteerGroup =>
  'kind' in row && (row as TimesheetGroupRow).kind === 'volunteer';
const isAssignmentGroup = (row: TimesheetRow): row is TimesheetAssignmentGroup =>
  'kind' in row && (row as TimesheetGroupRow).kind === 'assignment';

const getEntryRowClassName = (row: TimesheetRow): string | undefined => {
  if (isGroupRow(row)) return undefined;
  switch (row.status) {
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
  const {
    formatWorkedPeriod,
    formatDuration,
    formatDurationByMinutes,
    formatDateTime,
  } = useFormatting();

  const [params, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: false,
  });

  const { sort, dir, location, group, status, shiftId, volunteerId, dateFrom, dateTo } =
    params;

  const sorting = useMemo(() => toSorting(sort, dir), [sort, dir]);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort, dir });
    void setParams({ ...resolved, page: 1 });
  };

  // Full dataset: needed when location filter is active or grouping is enabled
  const needsFullDataset = !!(location || group);
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

  // Apply client-side location filter to the full dataset
  const filteredFull = useMemo(() => {
    if (!fullEntries) return undefined;
    if (!location) return fullEntries;
    return fullEntries.filter(
      (e) => resolveTimeEntryLocation(e) === location,
    );
  }, [fullEntries, location]);

  // When grouped, also apply location filter to paginated entries for the table
  const displayEntries = useMemo(() => {
    if (location && !group) {
      // Client-side filter on current page
      return entries.filter((e) => resolveTimeEntryLocation(e) === location);
    }
    return entries;
  }, [entries, location, group]);

  // Grouped data uses the full filtered dataset
  const groupedRows = useMemo<TimesheetGroupRow[] | undefined>(() => {
    if (!group || !filteredFull) return undefined;
    return group === 'volunteer'
      ? groupByVolunteer(filteredFull)
      : groupByAssignment(filteredFull);
  }, [group, filteredFull]);

  const tableData: TimesheetRow[] = groupedRows ?? displayEntries;

  const columns = useMemo<ColumnDef<DataTableFeatures, TimesheetRow>[]>(
    () => [
      {
        id: 'SHIFT',
        enableSorting: !group,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.shift')} />
        ),
        cell: ({ row }) => {
          const original = row.original;
          if (isAssignmentGroup(original)) {
            return (
              <div className="flex items-center gap-1 font-medium">
                <button
                  type="button"
                  aria-label={row.getIsExpanded() ? t('table.collapse') : t('table.expand')}
                  onClick={row.getToggleExpandedHandler()}
                  className="shrink-0"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <TextCell>{original.title}</TextCell>
              </div>
            );
          }
          if (isGroupRow(original)) return null;
          return (
            <Link
              className="block hover:underline"
              href={`/admin/${organizationUnitId}/timesheets/${original.id}`}
            >
              <TextCell>
                {original.shiftInstance?.master?.title ??
                  original.organizationUnit?.name ??
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
        cell: ({ row }) => {
          if (isGroupRow(row.original)) return null;
          return (
            <TextCell>
              {resolveTimeEntryLocation(row.original) ?? t('table.notAvailable')}
            </TextCell>
          );
        },
      },
      {
        id: 'VOLUNTEER',
        enableSorting: !group,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.volunteer')} />
        ),
        cell: ({ row }) => {
          const original = row.original;
          if (isVolunteerGroup(original)) {
            return (
              <div className="flex items-center gap-1 font-medium">
                <button
                  type="button"
                  aria-label={row.getIsExpanded() ? t('table.collapse') : t('table.expand')}
                  onClick={row.getToggleExpandedHandler()}
                  className="shrink-0"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <TextCell>
                  {original.volunteer.name ?? original.volunteer.email}
                </TextCell>
              </div>
            );
          }
          if (isGroupRow(original)) return null;
          return (
            <TextCell>
              {original.volunteer?.name ??
                original.volunteer?.email ??
                t('table.notAvailable')}
            </TextCell>
          );
        },
      },
      {
        id: 'STARTED_AT',
        enableSorting: !group,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.date')} />
        ),
        cell: ({ row }) => {
          if (isGroupRow(row.original)) return null;
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
        cell: ({ row }) => {
          if (isGroupRow(row.original)) return null;
          return <TimeEntryStatusBadge status={row.original.status} />;
        },
      },
      {
        id: 'DURATION',
        enableSorting: !group,
        meta: { headerClassName: 'text-right' },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.duration')} />
        ),
        cell: ({ row }) => {
          const original = row.original;
          if (isGroupRow(original)) {
            return (
              <NumberCell>
                {formatDurationByMinutes(original.totalDurationMinutes)}
              </NumberCell>
            );
          }
          if (original.status === TimeEntryStatus.Open) {
            return <NumberCell>{NO_DURATION}</NumberCell>;
          }
          const duration = formatDuration(original.startedAt, original.endedAt);
          if (original.status === TimeEntryStatus.AutoClosed) {
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
        enableSorting: !group,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.recorded')} />
        ),
        cell: ({ row }) => {
          if (isGroupRow(row.original)) return null;
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
        cell: ({ row }) => {
          if (isGroupRow(row.original)) return null;
          return (
            <ActionBar
              id={row.original.id}
              organizationUnitId={organizationUnitId}
              status={row.original.status}
              size="sm"
            />
          );
        },
      },
    ],
    [
      t,
      group,
      formatWorkedPeriod,
      formatDuration,
      formatDurationByMinutes,
      formatDateTime,
      organizationUnitId,
    ],
  );

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  // Sum of visible leaf entries for footer
  const leafEntries = groupedRows
    ? groupedRows.flatMap((g) => g.subRows)
    : displayEntries;

  const totalDurationMinutes = useMemo(
    () => sumDurationMinutes(leafEntries),
    [leafEntries],
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

  const showPagination = !group && pagination.total > 0;

  return (
    <div className="space-y-4">
      <TimesheetsToolbar
        orgUnitId={organizationUnitId}
        locationOptions={locationOptions}
        isLoadingLocations={needsFullDataset && isLoadingFull}
      />
      <DataTable
        columns={columns}
        data={tableData}
        pageCount={group ? 1 : pageCount}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyMessage={t('empty.title')}
        getRowClassName={getEntryRowClassName}
        footerContent={tableData.length > 0 ? footerContent : undefined}
        {...(group
          ? {
              expansion: {
                getSubRows: (row: TimesheetRow) =>
                  isGroupRow(row) ? row.subRows : undefined,
                defaultAllExpanded: true,
              },
            }
          : {})}
      />
      {showPagination && (
        <DataTablePagination
          total={pagination.total}
          name={t('page.paginationName')}
        />
      )}
    </div>
  );
};

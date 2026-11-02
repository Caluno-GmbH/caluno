import { SortOrder } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { CreateTimeEntryButton } from '@/domain/time-entry/components/create-time-entry-button';
import { EmptyTimeEntries } from '@/domain/time-entry/components/empty-time-entries';
import { TimesheetsTable } from '@/domain/time-entry/components/timesheets-table';
import { toTimesheetDateRange } from '@/domain/time-entry/timesheets-date-range';
import { timesheetsSearchParamsCache } from '@/domain/time-entry/timesheets-search-params.server';
import { getDataClient } from '@/lib/data-client';

interface TimesheetsPageProps {
  params: Promise<{ orgUId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TimesheetsPage({
  params,
  searchParams,
}: TimesheetsPageProps) {
  const { orgUId } = await params;
  const t = await getTranslations('TimeEntry');

  const { sort, dir, status, shiftId, volunteerId, dateFrom, dateTo } =
    timesheetsSearchParamsCache.parse(await searchParams);

  const data = await getDataClient({ orgUId });

  const dateRange = toTimesheetDateRange(dateFrom, dateTo);

  const timeEntries = await data.timeEntry.findAll({
    limit: 1,
    offset: 0,
    sort,
    order: dir === 'desc' ? SortOrder.Desc : SortOrder.Asc,
    statuses: status.length > 0 ? status : undefined,
    volunteerId,
    shiftId,
    dateFrom: dateRange.dateFrom ?? null,
    dateTo: dateRange.dateTo ?? null,
  });

  const isFiltered =
    status.length > 0 || !!shiftId || !!volunteerId || !!dateFrom || !!dateTo;

  const showTable = timeEntries.pagination.total > 0 || isFiltered;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t('page.title')}</h1>
        <CreateTimeEntryButton orgUId={orgUId} />
      </div>

      {showTable ? (
        <TimesheetsTable organizationUnitId={orgUId} />
      ) : (
        <EmptyTimeEntries>
          <CreateTimeEntryButton orgUId={orgUId} />
        </EmptyTimeEntries>
      )}
    </div>
  );
}

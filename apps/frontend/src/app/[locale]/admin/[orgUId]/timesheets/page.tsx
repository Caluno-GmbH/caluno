import { SortOrder } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { CreateTimeEntryButton } from '@/domain/time-entry/components/create-time-entry-button';
import { EmptyTimeEntries } from '@/domain/time-entry/components/empty-time-entries';
import { TimeEntryStatusFilter } from '@/domain/time-entry/components/time-entry-status-filter';
import { TimesheetsTable } from '@/domain/time-entry/components/timesheets-table';
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

  const { sort, dir, page, pageSize, status } =
    timesheetsSearchParamsCache.parse(await searchParams);

  const limit = Number(pageSize);
  const data = await getDataClient({ orgUId });

  const timeEntries = await data.timeEntry.findAll({
    limit,
    offset: (page - 1) * limit,
    sort,
    order: dir === 'desc' ? SortOrder.Desc : SortOrder.Asc,
    statuses: status.length > 0 ? status : undefined,
  });
  const isFiltered = status.length > 0;
  // Keep the filter and table visible when a filter matches nothing.
  const showTable = timeEntries.pagination.total > 0 || isFiltered;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t('page.title')}</h1>
        <CreateTimeEntryButton orgUId={orgUId} />
      </div>

      {showTable ? (
        <div className="space-y-4">
          <TimeEntryStatusFilter />
          <TimesheetsTable
            entries={timeEntries.items}
            pagination={timeEntries.pagination}
            organizationUnitId={orgUId}
          />
        </div>
      ) : (
        <EmptyTimeEntries>
          <CreateTimeEntryButton orgUId={orgUId} />
        </EmptyTimeEntries>
      )}
    </div>
  );
}

import { SortOrder } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { CreateTimeEntryButton } from '@/domain/time-entry/components/create-time-entry-button';
import { EmptyTimeEntries } from '@/domain/time-entry/components/empty-time-entries';
import { TimesheetsTable } from '@/domain/time-entry/components/timesheets-table';
import { timesheetsSearchParamsCache } from '@/domain/time-entry/timesheets-search-params.server';
import { getDataClient } from '@/lib/data-client';

const PAGE_SIZE = 10;

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

  const { sort, dir, page } = timesheetsSearchParamsCache.parse(
    await searchParams,
  );

  const data = await getDataClient({ orgUId });

  const timeEntries = await data.timeEntry.findAll({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort,
    order: dir === 'desc' ? SortOrder.Desc : SortOrder.Asc,
  });
  const hasTimeEntries = timeEntries.pagination.total > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t('page.title')}</h1>
        <CreateTimeEntryButton orgUId={orgUId} />
      </div>

      {hasTimeEntries ? (
        <TimesheetsTable
          entries={timeEntries.items}
          pagination={timeEntries.pagination}
          organizationUnitId={orgUId}
        />
      ) : (
        <EmptyTimeEntries>
          <CreateTimeEntryButton orgUId={orgUId} />
        </EmptyTimeEntries>
      )}
    </div>
  );
}

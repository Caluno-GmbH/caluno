import { getTranslations } from 'next-intl/server';
import { Pagination } from '@/components/pagination';
import { CreateTimeEntryButton } from '@/domain/time-entry/components/create-time-entry-button';
import { EmptyTimeEntries } from '@/domain/time-entry/components/empty-time-entries';
import { TimesheetsTable } from '@/domain/time-entry/components/timesheets-table';
import { getDataClient } from '@/lib/data-client';

const PAGE_SIZE = 50;

interface TimesheetsPageProps {
  params: Promise<{ orgUId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function TimesheetsPage({
  params,
  searchParams,
}: TimesheetsPageProps) {
  const { orgUId } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const t = await getTranslations('TimeEntry');

  const data = await getDataClient({ orgUId });

  const timeEntries = await data.timeEntry.findAll({
    limit: PAGE_SIZE,
    offset,
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
          organizationUnitId={orgUId}
        />
      ) : (
        <EmptyTimeEntries>
          <CreateTimeEntryButton orgUId={orgUId} />
        </EmptyTimeEntries>
      )}

      {timeEntries.pagination.total > PAGE_SIZE && (
        <Pagination
          pagination={timeEntries.pagination}
          url={`/admin/${orgUId}/timesheets`}
          currentPage={currentPage}
          name="entries"
        />
      )}
    </div>
  );
}

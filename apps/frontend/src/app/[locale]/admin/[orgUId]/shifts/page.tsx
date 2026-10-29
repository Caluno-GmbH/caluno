import {
  type GetWeeklyShiftsQuery,
  PermissionKey,
  ShiftFillFilter,
  SortOrder,
} from '@repo/data';
import { parseISO } from 'date-fns';
import { getTranslations } from 'next-intl/server';
import { CreateShiftButton } from '@/domain/shift/components/create-shift-button';
import { EmptyShifts } from '@/domain/shift/components/empty-shifts';
import { ShiftCreatedDialog } from '@/domain/shift/components/shift-created-dialog';
import { ShiftTabSwitcher } from '@/domain/shift/components/shift-tab-switcher';
import { ShiftsTable } from '@/domain/shift/components/shifts-table';
import { WeeklyCalendar } from '@/domain/shift/components/weekly-calendar';
import { WeeklyCalendarNav } from '@/domain/shift/components/weekly-calendar-nav';
import { getWeekRange } from '@/domain/shift/lib/shift-instances';
import { shiftsSearchParamsCache } from '@/domain/shift/shifts-search-params.server';
import { orgHasShifts } from '@/domain/shift/weekplan';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { checkPermission } from '@/lib/permissions-server';

type ShiftViewType = 'weekplan' | 'shifts';

interface ShiftsPageProps {
  params: Promise<{ orgUId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseWeekStart(param: string | null | undefined): Date {
  const base = param ? parseISO(param) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(getWeekRange(d).weekStart.getTime());
}

export default async function ShiftsPage({
  params,
  searchParams,
}: ShiftsPageProps) {
  const { orgUId } = await params;
  const rawSearchParams = await searchParams;

  await requireOrgAccess(orgUId);
  const [canManage] = await checkPermission(orgUId, PermissionKey.ShiftEdit);

  const {
    sort,
    dir,
    page,
    pageSize,
    q,
    dateFrom,
    dateTo,
    location,
    visibility,
    fill,
  } = shiftsSearchParamsCache.parse(rawSearchParams);

  const view =
    (rawSearchParams.view as ShiftViewType | undefined) ?? 'weekplan';
  const week =
    typeof rawSearchParams.week === 'string' ? rawSearchParams.week : undefined;

  const isWeekplan = view !== 'shifts';
  const weekStart = parseWeekStart(week);

  const t = await getTranslations('Shift');

  const data = await getDataClient({ orgUId });
  let instances: GetWeeklyShiftsQuery['weeklyShifts'] | null = null;
  let orgShiftTotal = 0;

  if (isWeekplan) {
    const { weekEnd } = getWeekRange(weekStart);
    instances = await data.shift.findForWeek(weekStart, weekEnd);
    if (instances.length > 0) {
      orgShiftTotal = instances.length;
    } else {
      const shiftList = await data.shift.findAll({ limit: 1, offset: 0 });
      orgShiftTotal = shiftList.pagination.total;
    }
  }

  const showWeekplanCalendar = orgHasShifts(orgShiftTotal);

  if (!isWeekplan) {
    const limit = Number(pageSize);
    const [result, locationOptions] = await Promise.all([
      data.shift.findAll({
        limit,
        offset: (page - 1) * limit,
        sort,
        order: dir === 'desc' ? SortOrder.Desc : SortOrder.Asc,
        search: q || null,
        dateFrom: dateFrom ? dateFrom.toISOString().slice(0, 10) : undefined,
        dateTo: dateTo ? dateTo.toISOString().slice(0, 10) : undefined,
        location: location || undefined,
        visibility: visibility ?? undefined,
        fill:
          fill === 'below'
            ? ShiftFillFilter.Below
            : fill === 'full'
              ? ShiftFillFilter.Full
              : undefined,
      }),
      data.shift.findLocations(),
    ]);

    const hasActiveFilters = Boolean(
      q || dateFrom || dateTo || location || visibility || fill,
    );
    const showTable = result.pagination.total > 0 || hasActiveFilters;

    return (
      <div className="flex flex-col h-full gap-4">
        <ShiftCreatedDialog />

        <div>
          <h1 className="page-title mb-2">{t('page.title')}</h1>
          <div className="flex flex-col gap-2 lg:flex-row justify-between items-start">
            <ShiftTabSwitcher orgUId={orgUId} activeTab="shifts" week={week} />
            {canManage ? <CreateShiftButton orgUId={orgUId} /> : null}
          </div>
        </div>

        {showTable ? (
          <ShiftsTable
            shifts={result.items}
            pagination={result.pagination}
            orgUId={orgUId}
            page={page}
            locationOptions={locationOptions}
          />
        ) : (
          <EmptyShifts>
            {canManage ? <CreateShiftButton orgUId={orgUId} /> : null}
          </EmptyShifts>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <ShiftCreatedDialog />

      <div>
        <h1 className="page-title mb-2">{t('page.title')}</h1>
        <div className="flex flex-col gap-2 lg:flex-row justify-between items-start">
          <ShiftTabSwitcher orgUId={orgUId} activeTab="weekplan" week={week} />
          {isWeekplan && showWeekplanCalendar && (
            <WeeklyCalendarNav
              weekStart={weekStart}
              pathname={`/admin/${orgUId}/shifts`}
              query={{ view: 'weekplan' }}
            />
          )}
          {canManage ? <CreateShiftButton orgUId={orgUId} /> : null}
        </div>
      </div>

      {showWeekplanCalendar ? (
        <WeeklyCalendar
          instances={instances ?? []}
          canManage={canManage}
          weekStart={weekStart}
          orgUId={orgUId}
        />
      ) : (
        <EmptyShifts>
          {canManage ? <CreateShiftButton orgUId={orgUId} /> : null}
        </EmptyShifts>
      )}
    </div>
  );
}

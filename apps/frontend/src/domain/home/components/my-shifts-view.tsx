'use client';

import {
  type MyShiftInstance,
  type MyShiftInstancesInfiniteResult,
  SortOrder,
  useMyShiftInstancesInfinite,
} from '@repo/data/react';
import { Button, Empty, EmptyMedia, EmptyTitle, Skeleton } from '@repo/ui';
import { CalendarXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  getDayStripDays,
  getSparseDayStripDays,
  groupByDay,
  startOfDay,
} from '../lib/date-helpers';
import { useDelayedLoading } from '../lib/use-delayed-loading';
import { DayTimelineView } from './day-timeline-view';
import { MyShiftsDayRows } from './my-shifts-day-rows';

interface MyShiftsViewProps {
  initialFuturePage?: MyShiftInstancesInfiniteResult;
}

export function MyShiftsView({ initialFuturePage }: MyShiftsViewProps) {
  const t = useTranslations('VolunteerHome');
  const tCommon = useTranslations('Common');
  const today = startOfDay(new Date());

  const futureQuery = useMyShiftInstancesInfinite(
    {
      startsAfter: today,
      order: SortOrder.Asc,
      limit: 15,
      includeIntended: true,
    },
    {
      initialData: initialFuturePage
        ? { pages: [initialFuturePage], pageParams: [0] }
        : undefined,
    },
  );

  const [pastEnabled, setPastEnabled] = useState(false);
  const pastQuery = useMyShiftInstancesInfinite(
    {
      includePast: true,
      endsBefore: today,
      order: SortOrder.Desc,
      limit: 15,
      includeIntended: true,
    },
    { enabled: pastEnabled },
  );

  // Only the initial future fetch blank-slates the page. Past pages load in
  // place (button shows its own loading state) so the day strip / scroll-spy
  // stay mounted and keep working after "Load past".
  const isLoading = futureQuery.isLoading;
  const showLoading = useDelayedLoading(isLoading);

  // Preserve the viewport when past shifts are prepended while the user is
  // mid-list. If they are already at the top (Load past button visible), keep
  // scrollY so the newly loaded days stay on screen.
  const previousScrollHeightRef = useRef(0);
  const wasNearTopRef = useRef(false);
  useEffect(() => {
    if (pastQuery.isFetching) {
      previousScrollHeightRef.current = document.documentElement.scrollHeight;
      wasNearTopRef.current = window.scrollY < 8;
    }
  }, [pastQuery.isFetching]);
  useEffect(() => {
    if (!pastQuery.isFetching && previousScrollHeightRef.current > 0) {
      if (!wasNearTopRef.current) {
        const heightDiff =
          document.documentElement.scrollHeight -
          previousScrollHeightRef.current;
        if (heightDiff > 0) {
          window.scrollBy({ top: heightDiff, behavior: 'instant' });
        }
      }
      previousScrollHeightRef.current = 0;
      wasNearTopRef.current = false;
    }
  }, [pastQuery.isFetching]);

  const pastItems = useMemo<MyShiftInstance[]>(() => {
    if (!pastQuery.data) return [];
    return pastQuery.data.pages.flatMap((page) => page.items).reverse();
  }, [pastQuery.data]);

  const futureItems = useMemo<MyShiftInstance[]>(() => {
    if (!futureQuery.data) return [];
    return futureQuery.data.pages.flatMap((page) => page.items);
  }, [futureQuery.data]);

  const myShiftList = useMemo<MyShiftInstance[]>(
    () => [...pastItems, ...futureItems],
    [pastItems, futureItems],
  );

  const dayStrip = useMemo(
    () => getDayStripDays(myShiftList, { includePast: true, minDays: 7 }),
    [myShiftList],
  );
  const sparseDayStrip = useMemo(
    () => getSparseDayStripDays(myShiftList),
    [myShiftList],
  );
  const grouped = useMemo(() => groupByDay(myShiftList), [myShiftList]);

  const now = new Date();
  const firstUpcomingIndex = myShiftList.findIndex(
    (shift) => new Date(shift.actualEndsAt).getTime() >= now.getTime(),
  );
  const nextShiftId =
    firstUpcomingIndex >= 0 ? myShiftList[firstUpcomingIndex]?.id : undefined;

  const handleLoadPast = () => {
    if (!pastEnabled) {
      setPastEnabled(true);
    } else if (pastQuery.hasNextPage && !pastQuery.isFetching) {
      pastQuery.fetchNextPage();
    }
  };

  const showLoadPast =
    !pastEnabled || pastQuery.hasNextPage || pastQuery.isFetching;

  const loadPastButton = showLoadPast && (
    <div className="flex justify-center py-4">
      <Button
        variant="outline"
        size="md"
        onClick={handleLoadPast}
        disabled={pastQuery.isFetching}
      >
        {pastQuery.isFetching ? tCommon('loading') : t('loadPast')}
      </Button>
    </div>
  );

  const showLoadMore = futureQuery.hasNextPage || futureQuery.isFetching;

  const loadMoreButton = showLoadMore && (
    <div className="flex justify-center py-4">
      <Button
        variant="outline"
        size="md"
        onClick={() => futureQuery.fetchNextPage()}
        disabled={futureQuery.isFetching}
      >
        {futureQuery.isFetching ? tCommon('loading') : t('loadMore')}
      </Button>
    </div>
  );

  return (
    <DayTimelineView
      title={t('yourShiftsHeading')}
      isLoading={showLoading}
      days={dayStrip}
      sparseDays={sparseDayStrip}
      goToTopLabel={t('goToTop')}
      initialScroll="top"
      listPrefix={loadPastButton}
      groups={grouped}
      hasContent={myShiftList.length > 0}
      loading={
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
      empty={
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarXIcon />
          </EmptyMedia>
          <EmptyTitle>{t('yourShiftsEmpty')}</EmptyTitle>
          <Button asChild variant="default" size="lg">
            <Link href="/discover">{t('discoverCta')}</Link>
          </Button>
        </Empty>
      }
      renderContent={(group) => {
        const isLastGroup =
          group.date.getTime() === grouped[grouped.length - 1]?.date.getTime();
        return (
          <>
            <MyShiftsDayRows
              group={group}
              nextShiftId={nextShiftId}
              now={now}
            />
            {isLastGroup && loadMoreButton}
          </>
        );
      }}
      isDayDimmed={(group) => group.date.getTime() < startOfDay(now).getTime()}
    />
  );
}

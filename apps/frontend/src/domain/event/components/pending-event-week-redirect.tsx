'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { takePendingEventWeek } from '../pending-event-week';
import { eventDetailPath } from '../routes';

interface PendingEventWeekRedirectProps {
  orgUId: string;
  eventId: string;
}

/**
 * Moves the shifts calendar to the week of a just-created shift. The event page
 * stays mounted under the shift sheets, so this runs whenever the pathname
 * returns to the event page, not only on first mount.
 */
export function PendingEventWeekRedirect({
  orgUId,
  eventId,
}: PendingEventWeekRedirectProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== eventDetailPath(orgUId, eventId)) return;

    const week = takePendingEventWeek(eventId);
    if (week) {
      router.replace(`${pathname}?tab=shifts&week=${week}`);
    }
  }, [pathname, orgUId, eventId, router]);

  return null;
}

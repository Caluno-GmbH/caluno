'use client';

import type { ShiftInviteStatus } from '@repo/data';
import { Card, cn } from '@repo/ui';
import { CalendarDaysIcon, ChevronRightIcon, MapPinIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { shiftPublicPath } from '@/domain/shift/share';
import { Link } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ShiftRosterStatusLine } from './shift-roster-status-line';

export interface ShiftCardMyShiftProps {
  shiftInstance: {
    id: string;
    actualStartsAt: string;
    actualEndsAt: string;
    myInviteStatus?: ShiftInviteStatus | null;
    master: {
      id: string;
      title: string;
      location?: string | null;
      event?: { id: string; title: string } | null;
    };
  };
  /** Show the shift's date (used in the home preview where there is no day head). */
  showDate?: boolean;
  /** Past shift: dimmed and non-interactive (no link). */
  past?: boolean;
  /** Show the inline time range. Off when an external time rail already shows it. */
  showTime?: boolean;
  /** True when the user signed up but the org-unit membership request is still pending. */
  isPending?: boolean;
}

export function ShiftCardMyShift({
  shiftInstance,
  showDate = false,
  past = false,
  showTime = true,
  isPending = false,
}: ShiftCardMyShiftProps) {
  const { formatTimeRange, formatDate } = useFormatting();
  const t = useTranslations('VolunteerHome');
  const event = shiftInstance.master.event;

  return (
    <Card
      className={cn(
        'relative flex h-full w-full flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0',
        past && 'opacity-55',
      )}
    >
      {/* Past shifts are read-only (AC33) — no link. */}
      {!past && (
        <Link
          href={shiftPublicPath(shiftInstance.master.id, shiftInstance.id)}
          prefetch={false}
          aria-label={shiftInstance.master.title}
          className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        {showDate && (
          <p className="text-sm font-semibold text-foreground">
            {formatDate(new Date(shiftInstance.actualStartsAt), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </p>
        )}
        {showTime && (
          <p className="text-sm text-muted-foreground">
            {formatTimeRange(
              shiftInstance.actualStartsAt,
              shiftInstance.actualEndsAt,
            )}
          </p>
        )}
        <ShiftRosterStatusLine
          isIntendingToJoin={isPending}
          myInviteStatus={shiftInstance.myInviteStatus}
        />
        <h3 className="line-clamp-2 font-semibold text-foreground">
          {shiftInstance.master.title}
        </h3>
        {shiftInstance.master.location && (
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" />
            {shiftInstance.master.location}
          </p>
        )}
      </div>
      {event && (
        <Link
          href={`/events/${event.id}`}
          prefetch={false}
          className="relative z-10 flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDaysIcon className="size-[13px] shrink-0" />
            <span className="truncate">
              {t('partOfEvent', { event: event.title })}
            </span>
          </span>
          <ChevronRightIcon className="size-[13px] shrink-0" />
        </Link>
      )}
    </Card>
  );
}

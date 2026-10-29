'use client';

import {
  EventInviteStatus,
  fromGraphQLError,
  JoinStatus,
  RequiredFormTargetType,
  ShiftInviteStatus,
} from '@repo/data';
import {
  useJoinEvent,
  useJoinShiftInstance,
  useUpdateEventInviteStatus,
  useUpdateShiftInstanceInviteStatus,
} from '@repo/data/react';
import { Badge, Button, Card } from '@repo/ui';
import {
  CalendarIcon,
  CheckIcon,
  MapPinIcon,
  RepeatIcon,
  TicketIcon,
  XIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CompensationNotice } from '@/domain/shift/components/compensation-notice';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { getInitials } from '@/lib/get-initials';
import type { MergedInvitation } from '../lib/merge-invitations';
import { normalizeInvitation } from '../lib/normalize-invitation';
import { useRecurrenceLabel } from '../lib/recurrence-label';

export function InviteCardMyInvited({ invite }: { invite: MergedInvitation }) {
  const t = useTranslations('VolunteerHome');
  const router = useRouter();
  const pathname = usePathname();
  const { formatDate, formatTimeRange, formatDateRange } = useFormatting();
  const getRecurrenceLabel = useRecurrenceLabel();
  const respondToShiftInvite = useUpdateShiftInstanceInviteStatus();
  const respondToEventInvite = useUpdateEventInviteStatus();
  const joinShiftInstance = useJoinShiftInstance();
  const joinEvent = useJoinEvent();

  const n = normalizeInvitation(invite);

  const isPending =
    respondToShiftInvite.isPending ||
    respondToEventInvite.isPending ||
    joinShiftInstance.isPending ||
    joinEvent.isPending;

  const respond = async (accept: boolean) => {
    try {
      if (!accept) {
        if (n.kind === 'shift') {
          await respondToShiftInvite.mutateAsync({
            instanceId: n.id,
            status: ShiftInviteStatus.VolunteerRejected,
          });
        } else {
          await respondToEventInvite.mutateAsync({
            eventId: n.id,
            status: EventInviteStatus.VolunteerRejected,
          });
        }
        toast.success(t('inviteDeclined'));
        router.refresh();
        return;
      }

      // Accept goes through join so required forms are gated like the join CTA.
      if (invite.kind === 'shift') {
        const shiftId = invite.shift.master.id;
        const organizationUnitId = invite.shift.master.organizationUnit.id;
        const result = await joinShiftInstance.mutateAsync(n.id);

        if (
          result.status === JoinStatus.Joined ||
          result.status === JoinStatus.WaitlistJoined ||
          result.status === JoinStatus.PendingApproval
        ) {
          toast.success(t('inviteAccepted'));
          router.refresh();
          return;
        }

        if (result.status === JoinStatus.RequirementsNeeded) {
          const missingForms = (result.requiredForms ?? []).filter(
            (f) => !f.submitted,
          );
          if (missingForms.length > 0) {
            const redirectTo = encodeURIComponent(pathname);
            const first = missingForms[0];
            if (
              first?.targetType === RequiredFormTargetType.Shift ||
              first?.targetType === RequiredFormTargetType.ShiftInstance
            ) {
              router.push(
                `/shifts/${shiftId}/instances/${n.id}/forms?redirectTo=${redirectTo}`,
              );
            } else {
              router.push(
                `/join/${organizationUnitId}/forms?redirectTo=${redirectTo}`,
              );
            }
            return;
          }
        }

        toast.error(t('inviteActionFailed'));
        return;
      }

      const result = await joinEvent.mutateAsync(n.id);

      if (
        result.status === JoinStatus.Joined ||
        result.status === JoinStatus.PendingApproval
      ) {
        toast.success(t('inviteAccepted'));
        router.refresh();
        return;
      }

      if (result.status === JoinStatus.RequirementsNeeded) {
        const missingForms = (result.requiredForms ?? []).filter(
          (f) => !f.submitted,
        );
        if (missingForms.length > 0) {
          const redirectTo = encodeURIComponent(pathname);
          router.push(`/events/${n.id}/forms?redirectTo=${redirectTo}`);
          return;
        }
      }

      toast.error(t('inviteActionFailed'));
    } catch (error) {
      toast.error(fromGraphQLError(error).message ?? t('inviteActionFailed'));
    }
  };

  const recurrenceLabel = n.rrule ? getRecurrenceLabel(n.rrule) : null;
  const timeLabel = n.isMultiDay
    ? formatDateRange(n.startsAt, n.endsAt)
    : formatTimeRange(n.startsAt, n.endsAt);
  const weekday = formatDate(new Date(n.startsAt), { weekday: 'short' });
  const day = formatDate(new Date(n.startsAt), { day: 'numeric' });
  const month = formatDate(new Date(n.startsAt), { month: 'short' });

  const TypeIcon = n.kind === 'shift' ? CalendarIcon : TicketIcon;
  const typeLabel =
    n.kind === 'shift' ? t('inviteKindShift') : t('inviteKindEvent');

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={n.detailHref}
        prefetch={false}
        aria-hidden="true"
        tabIndex={-1}
        className="flex items-center gap-2"
      >
        <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
          {n.orgLogoUrl ? (
            <Image
              src={n.orgLogoUrl}
              alt=""
              fill
              unoptimized
              sizes="28px"
              className="object-cover"
            />
          ) : (
            <span className="text-sm font-bold">{getInitials(n.orgName)}</span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {t('invitedOn', {
              date: formatDate(
                n.invitedAt ? new Date(n.invitedAt) : new Date(n.startsAt),
                { day: 'numeric', month: 'short' },
              ),
            })}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {n.orgName}
          </span>
        </div>
      </Link>

      <Card className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-none">
        <Link
          href={n.detailHref}
          prefetch={false}
          aria-label={n.title}
          className="flex gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
        >
          <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-[10px] bg-muted py-2">
            <span className="text-[11px] font-bold tracking-[1px] text-primary">
              {weekday.toUpperCase()}
            </span>
            <span className="text-[22px] font-bold leading-[1.15] text-foreground">
              {day}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {month}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-accent-foreground">
                {timeLabel}
              </span>
              <div className="flex items-center gap-1">
                {recurrenceLabel && (
                  <span className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                    <RepeatIcon className="size-3" />
                    {recurrenceLabel}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="gap-1 rounded-[10px] font-semibold text-muted-foreground"
                >
                  <TypeIcon className="size-3.5" />
                  {typeLabel}
                </Badge>
              </div>
            </div>
            <h3 className="truncate text-base font-semibold leading-[1.3] text-foreground">
              {n.title}
            </h3>
            {n.location && (
              <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
                <MapPinIcon className="size-3 shrink-0" />
                <span className="truncate">{n.location}</span>
              </p>
            )}
          </div>
        </Link>

        <CompensationNotice reimbursementTypeKey={n.reimbursementTypeKey} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            className="min-w-0 flex-1 text-lg"
            disabled={isPending}
            onClick={() => respond(false)}
          >
            <XIcon />
            {t('inviteDecline')}
          </Button>
          <Button
            size="lg"
            className="min-w-0 flex-1 text-lg"
            disabled={isPending}
            onClick={() => respond(true)}
          >
            <CheckIcon />
            {t('inviteAccept')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

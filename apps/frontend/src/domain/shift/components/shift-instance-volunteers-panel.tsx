'use client';

import { MembershipRequestStatus, ShiftInviteStatus } from '@repo/data';
import {
  Badge,
  Button,
  type ShiftVolunteeringDisplayState,
  type VolunteeringActionLabel,
  VolunteeringVolunteerList,
  type VolunteeringVolunteerListItem,
} from '@repo/ui';
import { Megaphone, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  checkInVolunteer,
  checkOutVolunteer,
} from '@/domain/time-entry/actions';
import { useSheetTrigger } from '@/hooks/use-sheet';
import { Link, useRouter } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import {
  remindShiftInstanceInvite,
  updateShiftInstanceInviteStatus,
} from '../actions';
import {
  type CheckInTimeEntry,
  deriveAcceptedRowState,
  formatCheckedOutWindows,
  groupTimeEntriesByVolunteer,
  openTimeEntryId,
} from '../check-in-state';
import {
  adminChipTargetStatuses,
  adminRowActions,
  canRemindInvitee,
  countInviteDisplayStates,
  formatInviteStatusSummary,
  toInviteDisplayState,
} from '../invite-status-display';
import { shiftInvitePath } from '../routes';
import { SendCallOutDialog } from './send-call-out-dialog';

type InstanceInvite = {
  status: ShiftInviteStatus;
  remindedAt?: string | null;
  user: {
    id: string;
    name: string;
    email?: string | null;
    image?: string | null;
    checkInId: string;
  };
};

type ShiftInstanceVolunteersPanelProps = {
  orgUId: string;
  shiftId: string;
  instanceId: string;
  invites: InstanceInvite[];
  timeEntries: CheckInTimeEntry[];
  spotsLeft: number | null | undefined;
  filledCount: number;
  maxVolunteers: number | null | undefined;
  canManage: boolean;
  isInstanceInThePast: boolean;
};

export function ShiftInstanceVolunteersPanel({
  orgUId,
  shiftId,
  instanceId,
  invites,
  timeEntries,
  spotsLeft,
  filledCount,
  maxVolunteers,
  canManage,
  isInstanceInThePast,
}: ShiftInstanceVolunteersPanelProps) {
  const { formatDate, formatTime } = useFormatting();
  const t = useTranslations('Shift');
  const tVolunteer = useTranslations('Volunteer.action');
  const router = useRouter();
  const { open: openVolunteerSheet } = useSheetTrigger('volunteer-profile');
  const [pending, startTransition] = useTransition();

  const timeEntriesByVolunteer = groupTimeEntriesByVolunteer(timeEntries);

  const stateLabel = (state: ShiftVolunteeringDisplayState) => {
    switch (state) {
      case 'invited':
        return t('inviteStatus.invited');
      case 'accepted':
        return t('inviteStatus.accepted');
      case 'signed_up':
        return t('inviteStatus.signedUp');
      case 'declined':
        return t('inviteStatus.declined');
      case 'cancelled':
        return t('inviteStatus.cancelled');
      case 'rejected':
        return t('inviteStatus.rejected');
      case 'requested':
        return t('inviteStatus.pendingApproval');
      case 'waitlisted':
        return t('inviteStatus.waitlisted');
      case 'checked_in':
        return t('inviteStatus.checkedIn');
      case 'not_checked_in':
        return t('inviteStatus.notCheckedIn');
      case 'checked_out':
        return t('inviteStatus.checkedOut');
      default:
        return state;
    }
  };

  const chipOptionLabel = (target: ShiftInviteStatus) => {
    switch (target) {
      case ShiftInviteStatus.Joined:
        return t('inviteStatus.accepted');
      case ShiftInviteStatus.AdminRejected:
        return t('inviteStatus.rejected');
      case ShiftInviteStatus.AdminInvited:
        return t('inviteStatus.invited');
      default:
        return target;
    }
  };

  const volunteers: VolunteeringVolunteerListItem[] = invites.map((invite) => {
    const remindVisible =
      canManage &&
      !isInstanceInThePast &&
      invite.status === ShiftInviteStatus.AdminInvited;
    const remindActive = canRemindInvitee(invite.status, invite.remindedAt);

    const chipTargets = canManage ? adminChipTargetStatuses(invite.status) : [];
    const rowActions = canManage ? adminRowActions(invite.status) : [];

    const baseState = toInviteDisplayState(invite.status);
    // Entries are only meaningful for accepted invites — every other status
    // keeps its normal invite-derived state and ignores time entries.
    const entries =
      baseState === 'accepted'
        ? timeEntriesByVolunteer.get(invite.user.id)
        : undefined;
    const state: ShiftVolunteeringDisplayState =
      baseState === 'accepted' ? deriveAcceptedRowState(entries) : baseState;

    const checkInAction: VolunteeringActionLabel[] =
      state === 'not_checked_in'
        ? ['Check in']
        : state === 'checked_in'
          ? ['Check out']
          : [];

    const statusTooltip =
      state === 'checked_out' && entries
        ? (() => {
            const { lines, overflowCount } = formatCheckedOutWindows(
              entries,
              formatTime,
            );
            return (
              <div className="flex flex-col gap-0.5 text-xs">
                {lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                {overflowCount > 0 ? (
                  <span>
                    {t('checkIn.moreWindows', { count: overflowCount })}
                  </span>
                ) : null}
              </div>
            );
          })()
        : undefined;

    return {
      id: invite.user.id,
      name: invite.user.name,
      image: invite.user.image,
      state,
      statusLabel: stateLabel(state),
      statusTooltip,
      statusOptions:
        chipTargets.length > 0
          ? chipTargets.map((target) => ({
              value: target,
              label: chipOptionLabel(target),
            }))
          : undefined,
      statusMenuAriaLabel: t('inviteStatus.changeStatusAria'),
      actions: remindVisible
        ? ['Remind', ...rowActions]
        : [...checkInAction, ...rowActions],
      disabledActions: remindVisible && !remindActive ? ['Remind'] : undefined,
      actionLabels: remindVisible
        ? {
            Remind: remindActive
              ? t('inviteStatus.actionRemind')
              : t('inviteStatus.actionReminded'),
          }
        : undefined,
      actionTooltips:
        remindVisible && invite.remindedAt
          ? {
              Remind: t('inviteStatus.remindedAtTooltip', {
                when: `${formatDate(new Date(invite.remindedAt), {
                  month: 'short',
                  day: 'numeric',
                })}, ${formatTime(new Date(invite.remindedAt))}`,
              }),
            }
          : undefined,
      iconActions: ['View'],
    };
  });

  const counts = countInviteDisplayStates(invites.map((i) => i.status));
  const summary = formatInviteStatusSummary(counts, spotsLeft, {
    invited: t('inviteStatus.summaryInvited'),
    accepted: t('inviteStatus.summaryAccepted'),
    signedUp: t('inviteStatus.summarySignedUp'),
    waitlisted: t('inviteStatus.summaryWaitlisted'),
    spots: t('inviteStatus.summarySpots'),
  });

  const openProfile = (invite: InstanceInvite) => {
    openVolunteerSheet({
      userId: invite.user.id,
      volunteerName: invite.user.name,
      volunteerStatus: MembershipRequestStatus.Accepted,
      volunteerEmail: invite.user.email ?? '',
      volunteerCheckInId: invite.user.checkInId,
    });
  };

  const applyStatus = (invite: InstanceInvite, target: ShiftInviteStatus) => {
    if (!canManage || pending) {
      return;
    }

    startTransition(async () => {
      const result = await updateShiftInstanceInviteStatus(orgUId, instanceId, {
        userId: invite.user.id,
        status: target,
      });
      if (result?.serverError) {
        toast.error(t('inviteStatus.statusChangeError'));
        return;
      }

      if (
        target === ShiftInviteStatus.Joined &&
        result?.data?.status === ShiftInviteStatus.WaitlistJoined
      ) {
        toast.success(t('inviteStatus.approveWaitlistedSuccess'));
      } else if (target === ShiftInviteStatus.Joined) {
        toast.success(t('inviteStatus.approveSuccess'));
      } else if (target === ShiftInviteStatus.AdminInvited) {
        toast.success(t('inviteStatus.inviteSuccess'));
      } else if (target === ShiftInviteStatus.AdminRejected) {
        toast.success(t('inviteStatus.declineSuccess'));
      }
      router.refresh();
    });
  };

  const onAction = (volunteerId: string, action: VolunteeringActionLabel) => {
    const invite = invites.find((item) => item.user.id === volunteerId);
    if (!invite) {
      return;
    }

    if (action === 'View') {
      openProfile(invite);
      return;
    }

    if (action === 'Check in') {
      if (pending) return;
      startTransition(async () => {
        const result = await checkInVolunteer({
          organizationUnitId: orgUId,
          volunteerId,
          shiftInstanceId: instanceId,
        });
        if (result?.serverError) {
          toast.error(t('checkIn.checkInError'));
          return;
        }
        toast.success(t('checkIn.checkInSuccess'));
        router.refresh();
      });
      return;
    }

    if (action === 'Check out') {
      const entryId = openTimeEntryId(timeEntriesByVolunteer.get(volunteerId));
      if (!entryId || pending) return;
      startTransition(async () => {
        const result = await checkOutVolunteer({
          timeEntryId: entryId,
          organizationUnitId: orgUId,
        });
        if (result?.serverError) {
          toast.error(t('checkIn.checkOutError'));
          return;
        }
        toast.success(t('checkIn.volunteerCheckedOut'));
        router.refresh();
      });
      return;
    }

    if (action === 'Approve') {
      applyStatus(invite, ShiftInviteStatus.Joined);
      return;
    }

    if (action === 'Remind') {
      if (!canManage || pending) {
        return;
      }
      if (!canRemindInvitee(invite.status, invite.remindedAt)) {
        return;
      }
      startTransition(async () => {
        const result = await remindShiftInstanceInvite(orgUId, instanceId, {
          userId: volunteerId,
        });
        if (result?.serverError) {
          toast.error(t('inviteStatus.remindError'));
          return;
        }
        toast.success(t('inviteStatus.remindSuccess'));
        router.refresh();
      });
      return;
    }

    if (action === 'Invite') {
      applyStatus(invite, ShiftInviteStatus.AdminInvited);
    }
  };

  const onStatusChange = (volunteerId: string, value: string) => {
    const invite = invites.find((item) => item.user.id === volunteerId);
    if (!invite) {
      return;
    }
    applyStatus(invite, value as ShiftInviteStatus);
  };

  return (
    <VolunteeringVolunteerList
      volunteers={volunteers}
      phase="before"
      title={t('inviteStatus.volunteersTitle')}
      summary={summary}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {maxVolunteers != null
              ? t('inviteStatus.capacityBadge', {
                  filled: filledCount,
                  max: maxVolunteers,
                })
              : t('inviteStatus.capacityBadgeNoMax', {
                  filled: filledCount,
                })}
          </Badge>
          {canManage ? (
            <>
              {!isInstanceInThePast ? (
                <SendCallOutDialog
                  orgUId={orgUId}
                  instanceId={instanceId}
                  trigger={
                    <Button variant="outline" size="md">
                      <Megaphone />
                      {t('instanceDetail.callOutCta')}
                    </Button>
                  }
                />
              ) : null}
              <Button asChild size="sm">
                <Link href={shiftInvitePath(orgUId, shiftId, instanceId)}>
                  <UserPlus />
                  {t('instanceDetail.inviteCta')}
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      }
      actionLabels={{
        View: tVolunteer('viewProfileAria'),
        'Check in': tVolunteer('checkInAria'),
        'Check out': tVolunteer('checkOutAria'),
        Invite: t('inviteStatus.actionInvite'),
        Approve: t('inviteStatus.actionApprove'),
        Remind: t('inviteStatus.actionRemind'),
      }}
      onAction={onAction}
      onStatusChange={canManage ? onStatusChange : undefined}
    />
  );
}

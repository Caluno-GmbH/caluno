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
import { useState, useTransition } from 'react';
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
  groupTimeEntriesByVolunteer,
  openTimeEntryId,
} from '../check-in-state';
import {
  adminChipTargetStatuses,
  adminRowActions,
  canRemindInvitee,
  groupInvitesByRosterGroup,
  toInviteDisplayState,
} from '../invite-status-display';
import { shiftInvitePath } from '../routes';
import { CheckedOutStatusTooltip } from './checked-out-status-tooltip';
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
  filledCount: number;
  maxVolunteers: number | null | undefined;
  canManage: boolean;
  canCheckIn: boolean;
  isInstanceInThePast: boolean;
};

export function ShiftInstanceVolunteersPanel({
  orgUId,
  shiftId,
  instanceId,
  invites,
  timeEntries,
  filledCount,
  maxVolunteers,
  canManage,
  canCheckIn,
  isInstanceInThePast,
}: ShiftInstanceVolunteersPanelProps) {
  const { formatDate, formatTime } = useFormatting();
  const t = useTranslations('Shift');
  const tVolunteer = useTranslations('Volunteer.action');
  const router = useRouter();
  const { open: openVolunteerSheet } = useSheetTrigger('volunteer-profile');
  const [, startTransition] = useTransition();

  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const markBusy = (volunteerId: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(volunteerId);
      } else {
        next.delete(volunteerId);
      }
      return next;
    });
  };

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

    const statusTooltip =
      state === 'checked_out' && entries ? (
        <CheckedOutStatusTooltip
          key={invite.user.id}
          entries={entries}
          formatTime={formatTime}
        />
      ) : undefined;

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
              state: toInviteDisplayState(target),
            }))
          : undefined,
      statusMenuAriaLabel: t('inviteStatus.changeStatusAria'),
      // Accepted rows defer to the ui status defaults (Check in / Check out per
      // check-in state, including re-check-in after checkout) and are only
      // suppressed when the user lacks CHECK_IN_MANAGE. adminRowActions is
      // empty for accepted invites, so there is nothing to merge.
      actions:
        baseState === 'accepted'
          ? canCheckIn
            ? undefined
            : []
          : remindVisible
            ? ['Remind', ...rowActions]
            : rowActions,
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
      iconActions: ['View', 'Check in'],
      busy: busyIds.has(invite.user.id),
    };
  });

  const volunteersById = new Map(
    volunteers.map((volunteer) => [volunteer.id, volunteer]),
  );

  const grouped = groupInvitesByRosterGroup(invites);

  const groups = [
    {
      key: 'coming',
      label: t('inviteStatus.groupComing'),
      volunteers: grouped.coming,
    },
    {
      key: 'pending',
      label: t('inviteStatus.groupPending'),
      volunteers: grouped.pending,
    },
    {
      key: 'notComing',
      label: t('inviteStatus.groupNotComing'),
      volunteers: grouped.notComing,
      defaultOpen: false,
    },
  ].map((group) => ({
    ...group,
    volunteers: group.volunteers
      .map((invite) => volunteersById.get(invite.user.id))
      .filter(
        (volunteer): volunteer is (typeof volunteers)[number] =>
          volunteer != null,
      ),
  }));

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
    const volunteerId = invite.user.id;
    if (!canManage || busyIds.has(volunteerId)) {
      return;
    }

    const toastId = `status-${volunteerId}`;
    toast.loading(
      t('inviteStatus.statusChangeLoading', { name: invite.user.name }),
      { id: toastId },
    );
    markBusy(volunteerId, true);

    startTransition(async () => {
      try {
        const result = await updateShiftInstanceInviteStatus(
          orgUId,
          instanceId,
          { userId: volunteerId, status: target },
        );

        if (result?.serverError) {
          toast.error(
            t('inviteStatus.statusChangeError', { name: invite.user.name }),
            { id: toastId },
          );
          return;
        }

        if (
          target === ShiftInviteStatus.Joined &&
          result?.data?.status === ShiftInviteStatus.WaitlistJoined
        ) {
          toast.success(t('inviteStatus.approveWaitlistedSuccess'), {
            id: toastId,
          });
        } else if (target === ShiftInviteStatus.Joined) {
          toast.success(t('inviteStatus.approveSuccess'), { id: toastId });
        } else if (target === ShiftInviteStatus.AdminInvited) {
          toast.success(t('inviteStatus.inviteSuccess'), { id: toastId });
        } else if (target === ShiftInviteStatus.AdminRejected) {
          toast.success(t('inviteStatus.removeSuccess'), { id: toastId });
        } else {
          toast.dismiss(toastId);
        }

        router.refresh();
      } catch {
        // A server action rejects rather than returning serverError when the
        // RPC call itself fails, the plain case being an offline browser.
        // Without this the loading toast is never resolved, and sonner gives
        // loading toasts no auto-dismiss and no close button, so it would sit
        // there forever with no way to clear it.
        toast.error(
          t('inviteStatus.statusChangeError', { name: invite.user.name }),
          { id: toastId },
        );
      } finally {
        markBusy(volunteerId, false);
      }
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
      if (!canCheckIn || busyIds.has(volunteerId)) return;
      markBusy(volunteerId, true);
      startTransition(async () => {
        try {
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
        } finally {
          markBusy(volunteerId, false);
        }
      });
      return;
    }

    if (action === 'Check out') {
      if (!canCheckIn || busyIds.has(volunteerId)) return;
      const entryId = openTimeEntryId(timeEntriesByVolunteer.get(volunteerId));
      if (!entryId) return;
      markBusy(volunteerId, true);
      startTransition(async () => {
        try {
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
        } finally {
          markBusy(volunteerId, false);
        }
      });
      return;
    }

    if (action === 'Approve') {
      applyStatus(invite, ShiftInviteStatus.Joined);
      return;
    }

    if (action === 'Remind') {
      if (!canManage || busyIds.has(volunteerId)) {
        return;
      }
      if (!canRemindInvitee(invite.status, invite.remindedAt)) {
        return;
      }

      const toastId = `remind-${volunteerId}`;
      toast.loading(
        t('inviteStatus.remindLoading', { name: invite.user.name }),
        { id: toastId },
      );
      markBusy(volunteerId, true);

      startTransition(async () => {
        try {
          const result = await remindShiftInstanceInvite(orgUId, instanceId, {
            userId: volunteerId,
          });

          if (result?.serverError) {
            toast.error(
              t('inviteStatus.remindError', { name: invite.user.name }),
              { id: toastId },
            );
            return;
          }

          toast.success(t('inviteStatus.remindSuccess'), { id: toastId });
          router.refresh();
        } catch {
          // See applyStatus: a rejected server action would otherwise strand an
          // undismissible loading toast.
          toast.error(
            t('inviteStatus.remindError', { name: invite.user.name }),
            { id: toastId },
          );
        } finally {
          markBusy(volunteerId, false);
        }
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
      groups={groups}
      phase="during"
      titleBadge={
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
      }
      title={t('inviteStatus.volunteersTitle')}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
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

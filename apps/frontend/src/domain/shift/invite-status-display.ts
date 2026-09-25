import { EventInviteStatus, ShiftInviteStatus } from '@repo/data';
import type {
  ShiftVolunteeringDisplayState,
  VolunteeringActionLabel,
} from '@repo/ui';

/** Shared invite-status values for shift + event (identical GraphQL enums). */
export type InviteStatus = ShiftInviteStatus | EventInviteStatus;

const ADMIN_UNINVITE_SOURCE_STATUS_VALUES = new Set<string>([
  ShiftInviteStatus.AdminInvited,
  ShiftInviteStatus.AwaitingAdminApproval,
  ShiftInviteStatus.WaitlistJoined,
  ShiftInviteStatus.Joined,
]);

/** Whether an admin can remove a volunteer (→ ADMIN_REJECTED). */
export function canAdminUninvite(status: InviteStatus): boolean {
  return ADMIN_UNINVITE_SOURCE_STATUS_VALUES.has(status);
}

/** Target status when an admin removes a volunteer. */
export function adminUninviteTargetStatus<S extends InviteStatus>(
  status: S,
): S | null {
  if (!canAdminUninvite(status)) {
    return null;
  }
  return ShiftInviteStatus.AdminRejected as S;
}

/** Whether an admin can re-invite a previously rejected volunteer (→ ADMIN_INVITED). */
export function canAdminReinvite(status: InviteStatus): boolean {
  return (
    status === ShiftInviteStatus.AdminRejected ||
    status === EventInviteStatus.AdminRejected
  );
}

/** Target status when an admin re-invites a rejected volunteer. */
export function adminReinviteTargetStatus<S extends InviteStatus>(
  status: S,
): S | null {
  if (!canAdminReinvite(status)) {
    return null;
  }
  return ShiftInviteStatus.AdminInvited as S;
}

export function adminRowActions(
  status: InviteStatus,
): VolunteeringActionLabel[] {
  switch (toInviteDisplayState(status)) {
    case 'requested':
      return ['Approve'];
    case 'rejected':
      return ['Invite'];
    default:
      return [];
  }
}

export function adminChipTargetStatuses(
  status: ShiftInviteStatus,
): ShiftInviteStatus[] {
  switch (status) {
    case ShiftInviteStatus.AdminInvited:
      return [ShiftInviteStatus.AdminRejected];
    case ShiftInviteStatus.AwaitingAdminApproval:
      return [ShiftInviteStatus.Joined, ShiftInviteStatus.AdminRejected];
    case ShiftInviteStatus.Joined:
      return [ShiftInviteStatus.AdminRejected];
    case ShiftInviteStatus.WaitlistJoined:
      return [ShiftInviteStatus.Joined, ShiftInviteStatus.AdminRejected];
    case ShiftInviteStatus.AdminRejected:
      return [ShiftInviteStatus.AdminInvited];
    default:
      return [];
  }
}

export function canRemindInvitee(
  status: InviteStatus,
  remindedAt?: Date | string | null,
): boolean {
  return status === ShiftInviteStatus.AdminInvited && remindedAt == null;
}

/**
 * Invite-sheet defaults: keep ADMIN_REJECTED off the Invited column so saving
 * the sheet (e.g. to add someone else) does not silently re-invite them.
 * Admins re-add them explicitly from Available.
 */
export function preselectedInviteMemberIds(
  members: ReadonlyArray<{ id: string; inviteStatus?: InviteStatus | null }>,
): string[] {
  return members
    .filter(
      (member) =>
        member.inviteStatus == null || !canAdminReinvite(member.inviteStatus),
    )
    .map((member) => member.id);
}

/** Domain invite status → backoffice display state (VOLI-842 / invite-status-model). */
export function toInviteDisplayState(
  status: InviteStatus,
): ShiftVolunteeringDisplayState {
  switch (status) {
    case ShiftInviteStatus.AdminInvited:
    case EventInviteStatus.AdminInvited:
      return 'invited';
    case ShiftInviteStatus.AwaitingAdminApproval:
    case EventInviteStatus.AwaitingAdminApproval:
      return 'requested';
    case ShiftInviteStatus.WaitlistJoined:
    case EventInviteStatus.WaitlistJoined:
      return 'waitlisted';
    case ShiftInviteStatus.Joined:
    case EventInviteStatus.Joined:
      return 'accepted';
    case ShiftInviteStatus.VolunteerRejected:
    case EventInviteStatus.VolunteerRejected:
      return 'declined';
    case ShiftInviteStatus.VolunteerCancelled:
    case EventInviteStatus.VolunteerCancelled:
      return 'cancelled';
    case ShiftInviteStatus.AdminRejected:
    case EventInviteStatus.AdminRejected:
      return 'rejected';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type RosterGroupKey = 'coming' | 'pending' | 'notComing';

/** Ordered so the group a supervisor must act on renders first. */
export const ROSTER_GROUP_ORDER: readonly RosterGroupKey[] = [
  'coming',
  'pending',
  'notComing',
];

export function toRosterGroup(status: InviteStatus): RosterGroupKey {
  switch (toInviteDisplayState(status)) {
    case 'accepted':
    case 'signed_up':
      return 'coming';
    case 'invited':
    case 'requested':
    case 'waitlisted':
      return 'pending';
    default:
      return 'notComing';
  }
}

/** Approval requests are the only state blocked on the coordinator, so they lead. */
const PENDING_RANK: Record<string, number> = {
  requested: 0,
  invited: 1,
  waitlisted: 2,
};

export function groupInvitesByRosterGroup<T extends { status: InviteStatus }>(
  invites: readonly T[],
): Record<RosterGroupKey, T[]> {
  const groups: Record<RosterGroupKey, T[]> = {
    coming: [],
    pending: [],
    notComing: [],
  };

  for (const invite of invites) {
    groups[toRosterGroup(invite.status)].push(invite);
  }

  groups.pending.sort(
    (a, b) =>
      (PENDING_RANK[toInviteDisplayState(a.status)] ?? 99) -
      (PENDING_RANK[toInviteDisplayState(b.status)] ?? 99),
  );

  return groups;
}

export function partitionInvitesByWaitlist<T extends { status: InviteStatus }>(
  volunteers: readonly T[],
): { invites: T[]; waitlisted: T[] } {
  const waitlisted = volunteers.filter(
    (invite) => invite.status === ShiftInviteStatus.WaitlistJoined,
  );
  const invites = volunteers.filter(
    (invite) => invite.status !== ShiftInviteStatus.WaitlistJoined,
  );
  return {
    invites,
    waitlisted,
  };
}

'use client';

import {
  useCheckInAddToShiftInstance,
  useCheckInApproveMembershipRequest,
  useCheckInInviteToOrganization,
} from '@repo/data/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * The readiness card's actions: invite to the org unit, accept the open
 * membership request, and add to the assignment — behind an "add anyway"
 * confirmation when the assignment is full.
 */
export function useCheckInReadinessActions({
  checkInId,
  orgUnitId,
  shiftInstanceId,
  membershipRequestId,
  shiftHasAvailableSeat,
}: {
  checkInId: string;
  orgUnitId: string;
  shiftInstanceId: string | null;
  membershipRequestId: string | null;
  shiftHasAvailableSeat: boolean;
}) {
  const t = useTranslations('CheckIn');

  // "Sent" is per org unit — tracked as the id it was sent for, so switching
  // to a different unit re-arms the button instead of carrying a stale
  // confirmation forward.
  const [orgInviteSentFor, setOrgInviteSentFor] = useState<string | null>(null);
  const [showOverCapacityConfirm, setShowOverCapacityConfirm] = useState(false);
  const inviteToOrgMutation = useCheckInInviteToOrganization(orgUnitId);
  const addToShiftMutation = useCheckInAddToShiftInstance(orgUnitId);
  const approveMembershipMutation =
    useCheckInApproveMembershipRequest(orgUnitId);

  const inviteToOrg = async () => {
    try {
      await inviteToOrgMutation.mutateAsync(checkInId);
      setOrgInviteSentFor(orgUnitId);
    } catch {
      toast.error(t('notMemberError'));
    }
  };

  const acceptMembership = async () => {
    if (!membershipRequestId) return;
    try {
      await approveMembershipMutation.mutateAsync(membershipRequestId);
    } catch {
      toast.error(t('acceptMembershipError'));
    }
  };

  const addToShift = async (allowOverCapacity: boolean) => {
    if (!shiftInstanceId) return;
    try {
      await addToShiftMutation.mutateAsync({
        checkInId,
        shiftInstanceId,
        allowOverCapacity,
      });
    } catch {
      toast.error(t('addToShiftError'));
    }
  };

  // A full assignment needs an explicit "add anyway" before going over
  // capacity; with a free seat the volunteer is added straight away.
  const requestAddToShift = () => {
    if (shiftHasAvailableSeat) {
      void addToShift(false);
    } else {
      setShowOverCapacityConfirm(true);
    }
  };

  return {
    inviteToOrg,
    isInviteToOrgPending: inviteToOrgMutation.isPending,
    isInviteToOrgSent: orgInviteSentFor === orgUnitId,
    acceptMembership,
    isAcceptMembershipPending: approveMembershipMutation.isPending,
    requestAddToShift,
    isAddToShiftPending: addToShiftMutation.isPending,
    overCapacityConfirm: {
      open: showOverCapacityConfirm,
      onOpenChange: setShowOverCapacityConfirm,
      onConfirm: () => {
        setShowOverCapacityConfirm(false);
        void addToShift(true);
      },
    },
  };
}

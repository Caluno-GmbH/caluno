'use client';

import { useQueryClient } from '@tanstack/react-query';
import { MembershipRequestRepository } from '../../repositories/membershipRequest/membershipRequest.repository';
import { ShiftRepository } from '../../repositories/shift/shift.repository';
import { TimeEntryRepository } from '../../repositories/time-entry/time-entry.repository';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

/**
 * Deliberately no query invalidation: per the spec, invite mutations leave
 * readiness state unchanged for this session (the volunteer must accept
 * elsewhere) — the caller settles the button into a "sent" confirmation via
 * local component state instead of re-arming from a refetch.
 */
export function useCheckInInviteToOrganization(organizationUnitId: string) {
  const sdk = useSdk();
  const repository = new TimeEntryRepository(sdk);

  return useMutation({
    mutationFn: (checkInId: string) =>
      repository.checkInInviteToOrganization(organizationUnitId, checkInId),
  });
}

/**
 * Adds the volunteer to the shift instance directly (no invitation round
 * trip). Invalidates readiness so the card reflects the new participation.
 */
export function useCheckInAddToShiftInstance(organizationUnitId: string) {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new ShiftRepository(sdk);

  return useMutation({
    mutationFn: ({
      checkInId,
      shiftInstanceId,
      allowOverCapacity,
    }: {
      checkInId: string;
      shiftInstanceId: string;
      allowOverCapacity: boolean;
    }) =>
      repository.checkInAddToShiftInstance(
        organizationUnitId,
        checkInId,
        shiftInstanceId,
        allowOverCapacity,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['check-in-readiness', organizationUnitId],
      });
    },
  });
}

export function useCheckInApproveMembershipRequest(organizationUnitId: string) {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new MembershipRequestRepository(sdk);

  return useMutation({
    mutationFn: (requestId: string) =>
      repository.checkInApprove(requestId, organizationUnitId),
    // Returning the readiness refetch keeps the mutation pending until the
    // card has moved past the accepted request, so it cannot be tapped twice.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-in-context'] });
      queryClient.invalidateQueries({ queryKey: ['check-in-required-forms'] });
      return queryClient.invalidateQueries({
        queryKey: ['check-in-readiness', organizationUnitId],
      });
    },
  });
}

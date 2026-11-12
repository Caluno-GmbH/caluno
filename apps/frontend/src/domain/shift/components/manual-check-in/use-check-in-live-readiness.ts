'use client';

import {
  type CheckInContextData,
  useCheckInContext,
  useCheckInReadiness,
  useCheckInVolunteerRequiredForms,
  useQueryClient,
} from '@repo/data/react';
import { useState } from 'react';
import { isCheckInAwaitingVolunteer } from '../../check-in-polling';
import {
  countMissingRequiredForms,
  resolveCheckInReadiness,
  resolveVisibleCheckInReadiness,
} from '../../check-in-readiness';
import { useCheckInPollWindow } from './use-check-in-poll-window';

/**
 * Everything the check-in page reads about the volunteer, kept live: the
 * check-in context, the readiness facts and the required forms poll on one
 * shared interval while the admin waits on the volunteer, until the poll
 * window expires (`refresh()` reopens it).
 */
export function useCheckInLiveReadiness({
  checkInId,
  initialContext,
  orgUnitId,
  shiftInstanceId,
  withoutShift,
}: {
  checkInId: string;
  initialContext: CheckInContextData;
  orgUnitId: string;
  shiftInstanceId: string | null;
  withoutShift: boolean;
}) {
  const queryClient = useQueryClient();

  // The poll window that decides the interval reads the query results, so its
  // output is mirrored into this state (adjusted during render, below).
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);

  // The context is seeded by the server render and re-fetched while polling,
  // so a volunteer who becomes related (sends a request) is revealed live.
  // `volunteer` stays null while unrelated: no identity reaches the DOM.
  const { data: liveContext } = useCheckInContext(checkInId, {
    initialData: initialContext,
    refetchInterval,
  });
  const context = liveContext ?? initialContext;
  const volunteer = context.volunteer;

  // Readiness always runs: with no instance chosen (or without-assignment)
  // the null instance returns only the membership facts, so a freshly
  // scanned volunteer can be invited before any shift is picked. The
  // shift-scoped states stay hidden until a choice is made (see
  // resolveVisibleCheckInReadiness).
  const { data: readiness } = useCheckInReadiness(
    orgUnitId,
    checkInId,
    shiftInstanceId,
    { enabled: true, refetchInterval },
  );
  const membershipRequest = readiness?.membershipRequest ?? null;
  const readinessState = resolveVisibleCheckInReadiness(
    readiness
      ? resolveCheckInReadiness(
          { ...readiness, membershipRequest },
          { requiresShift: !withoutShift },
        )
      : null,
    { withoutShift, shiftInstanceId },
  );

  // Fetched while an acceptable request is pending, so a volunteer completing
  // the required forms on their device is noticed. A request to an unmanaged
  // ancestor shows no forms, so they are not fetched for it.
  // `null` while unknown (loading or errored) so the accept stays blocked.
  const { data: requiredForms, isError: isRequiredFormsError } =
    useCheckInVolunteerRequiredForms(
      orgUnitId,
      checkInId,
      readinessState === 'pendingMembership' &&
        (membershipRequest?.canAccept ?? false),
      { refetchInterval },
    );
  const missingFormCount = countMissingRequiredForms({
    forms: requiredForms,
    isError: isRequiredFormsError,
  });

  // Polling runs while the admin waits on the volunteer, and the window
  // restarts whenever anything the page shows changes.
  const pollWindow = useCheckInPollWindow(
    isCheckInAwaitingVolunteer({
      isRelated: !!volunteer,
      state: readinessState,
    }),
    JSON.stringify([
      orgUnitId,
      volunteer?.id ?? null,
      context.pendingOrganizationUnits.map((unit) => unit.id),
      readiness
        ? [
            readiness.isMember,
            readiness.isParticipating,
            readiness.hasOpenTimeEntry,
            readiness.shiftHasAvailableSeat,
            readiness.idVerified,
          ]
        : null,
      membershipRequest,
      missingFormCount,
    ]),
  );
  if (pollWindow.refetchInterval !== refetchInterval) {
    setRefetchInterval(pollWindow.refetchInterval);
  }

  const refresh = () => {
    pollWindow.restart();
    // Refresh now rather than one interval after the restart.
    void queryClient.invalidateQueries({
      queryKey: ['check-in-context', checkInId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['check-in-readiness', orgUnitId, checkInId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['check-in-required-forms', orgUnitId, checkInId],
    });
  };

  return {
    volunteer,
    readiness,
    readinessState,
    membershipRequest,
    missingFormCount,
    isPollExpired: pollWindow.expired,
    refresh,
  };
}

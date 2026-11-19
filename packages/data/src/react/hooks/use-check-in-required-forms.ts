'use client';

import { useQuery } from '@tanstack/react-query';
import { TimeEntryRepository } from '../../repositories/time-entry/time-entry.repository';
import { useSdk } from './use-graphql-client';

/**
 * The required forms gating a check-in membership approval. Consumers enable
 * it only while it matters: the check-in page while a membership request is
 * pending (polling via `refetchInterval` to notice forms the volunteer submits
 * on their device), and the accept-membership sheet while it is open. Both
 * share one cache entry.
 */
export function useCheckInVolunteerRequiredForms(
  organizationUnitId: string,
  checkInId: string,
  enabled: boolean,
  options?: { refetchInterval?: number | false },
) {
  const sdk = useSdk();
  const repository = new TimeEntryRepository(sdk);

  return useQuery({
    queryKey: ['check-in-required-forms', organizationUnitId, checkInId],
    queryFn: () =>
      repository.getCheckInVolunteerRequiredForms(
        organizationUnitId,
        checkInId,
      ),
    enabled: !!organizationUnitId && !!checkInId && enabled,
    refetchInterval: options?.refetchInterval,
  });
}

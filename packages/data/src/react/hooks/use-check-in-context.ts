'use client';

import { useQuery } from '@tanstack/react-query';
import type { GetCheckInContextQuery } from '../../generated/graphql';
import { TimeEntryRepository } from '../../repositories/time-entry/time-entry.repository';
import { useSdk } from './use-graphql-client';

export type CheckInContextData = NonNullable<
  GetCheckInContextQuery['checkInContext']
>;

/**
 * Seeded from the server-rendered page via `initialData`; `refetchInterval`
 * lets the page notice the volunteer acting on their side (accepting an
 * invitation, submitting a form) without a manual reload.
 */
export function useCheckInContext(
  checkInId: string,
  options?: {
    initialData?: CheckInContextData;
    refetchInterval?: number | false;
  },
) {
  const sdk = useSdk();
  const repository = new TimeEntryRepository(sdk);

  return useQuery({
    queryKey: ['check-in-context', checkInId],
    queryFn: () => repository.getCheckInContext(checkInId),
    enabled: !!checkInId,
    initialData: options?.initialData,
    refetchInterval: options?.refetchInterval,
  });
}

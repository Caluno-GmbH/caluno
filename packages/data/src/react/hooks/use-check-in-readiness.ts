'use client';

import { useQuery } from '@tanstack/react-query';
import { TimeEntryRepository } from '../../repositories/time-entry/time-entry.repository';
import { useSdk } from './use-graphql-client';

/**
 * `options.enabled` overrides the default guard, which waits for a shift
 * instance. Pass `true` for the check-in-without-shift mode, where a null
 * instance is the point and the query still answers the membership facts.
 * `refetchInterval` keeps the readiness card live while the volunteer acts on
 * their own device.
 */
export function useCheckInReadiness(
  organizationUnitId: string,
  checkInId: string,
  shiftInstanceId: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  const sdk = useSdk();
  const repository = new TimeEntryRepository(sdk);

  return useQuery({
    queryKey: [
      'check-in-readiness',
      organizationUnitId,
      checkInId,
      shiftInstanceId,
    ],
    queryFn: () =>
      repository.getCheckInReadiness(
        organizationUnitId,
        checkInId,
        shiftInstanceId,
      ),
    enabled:
      !!organizationUnitId &&
      !!checkInId &&
      (options?.enabled ?? !!shiftInstanceId),
    refetchInterval: options?.refetchInterval,
  });
}

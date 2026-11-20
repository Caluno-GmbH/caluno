'use client';

import { type QueryClient, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TimeEntryStatus } from '../../generated/base-types';
import { TimeEntryRepository } from '../../repositories/time-entry/time-entry.repository';
import { useSdk } from './use-graphql-client';

export interface TimesheetBackendFilters {
  statuses?: TimeEntryStatus[];
  volunteerId?: string | null;
  shiftId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export function invalidateTimeEntryListQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['time-entries-all'] });
}

/**
 * Any write to a time entry made from the admin area (create, edit, delete,
 * confirm, check-out from the shift roster) changes the timesheets list and
 * the accounting views derived from entries, so refresh both (VOLI-1620).
 */
export function invalidateTimeEntryQueries(queryClient: QueryClient) {
  invalidateTimeEntryListQueries(queryClient);
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'eligible-time-entries'],
  });
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'awaiting-review-time-entries'],
  });
  queryClient.invalidateQueries({
    queryKey: ['accounting', 'volunteers-needing-timesheets'],
  });
}

export function useTimeEntriesAll(
  orgUnitId: string,
  filters: TimesheetBackendFilters,
  enabled: boolean,
) {
  const sdk = useSdk();
  const repository = useMemo(() => new TimeEntryRepository(sdk), [sdk]);

  return useQuery({
    queryKey: ['time-entries-all', orgUnitId, filters],
    queryFn: () =>
      repository.findAllUnpaginated({
        statuses: filters.statuses,
        volunteerId: filters.volunteerId,
        shiftId: filters.shiftId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    enabled: enabled && !!orgUnitId,
    staleTime: 30_000,
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
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

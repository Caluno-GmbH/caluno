'use client';

import { useQuery } from '@tanstack/react-query';
import { ShiftRepository } from '../../repositories/shift/shift.repository';
import { useSdk } from './use-graphql-client';

export function useShiftsForFilter(organizationUnitId: string) {
  const sdk = useSdk();
  const repository = new ShiftRepository(sdk);

  return useQuery({
    queryKey: ['shifts-for-filter', organizationUnitId],
    queryFn: () => repository.findAll({ limit: 500, offset: 0 }),
    enabled: !!organizationUnitId,
    staleTime: 5 * 60 * 1000,
  });
}

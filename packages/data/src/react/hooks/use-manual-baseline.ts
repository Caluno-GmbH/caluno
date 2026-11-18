'use client';
import { AccountingRepository, type RawManualBaseline } from '@repo/data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReimbursementTypeKey } from '../../generated/base-types';
import { useSdk } from './use-graphql-client';
import { useMutation } from './use-mutation';

export function useManualBaseline(
  volunteerId?: string,
  reimbursementTypeKey?: ReimbursementTypeKey,
  year?: number,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawManualBaseline>({
    queryKey: [
      'accounting',
      'manual-baseline',
      volunteerId,
      reimbursementTypeKey,
      year,
    ],
    queryFn: () =>
      repository.findManualBaseline(
        volunteerId ?? '',
        reimbursementTypeKey!,
        year ?? new Date().getFullYear(),
      ),
    staleTime: 30 * 1000,
    enabled: !!volunteerId && !!reimbursementTypeKey && !!year,
  });
}

export function useSetManualBaseline() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: (input: {
      volunteerId: string;
      reimbursementTypeKey: ReimbursementTypeKey;
      year: number;
      amountCents: number;
    }) => repository.setManualBaseline(input),
    onSuccess: (_, { volunteerId, reimbursementTypeKey, year }) => {
      queryClient.invalidateQueries({
        queryKey: [
          'accounting',
          'manual-baseline',
          volunteerId,
          reimbursementTypeKey,
          year,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'yearly-usage'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'roster-usage'],
      });
    },
  });
}

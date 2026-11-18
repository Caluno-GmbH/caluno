'use client';
import { AccountingRepository, type RawBundleDownloadStatus } from '@repo/data';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReimbursementTypeKey } from '../../generated/base-types';
import { useSdk } from './use-graphql-client';
import { invalidateInvoiceQueries } from './use-invoices';
import { useMutation } from './use-mutation';

export function useBundleDownloadStatus(
  volunteerId?: string,
  reimbursementTypeKey?: ReimbursementTypeKey,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawBundleDownloadStatus>({
    queryKey: [
      'accounting',
      'bundle-download-status',
      volunteerId,
      reimbursementTypeKey,
    ],
    queryFn: reimbursementTypeKey
      ? () =>
          repository.findBundleDownloadStatus(
            volunteerId ?? '',
            reimbursementTypeKey,
          )
      : skipToken,
    staleTime: 30 * 1000,
    enabled: !!volunteerId && !!reimbursementTypeKey,
  });
}

export function useRecordBundleDownload() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: ({
      volunteerId,
      reimbursementTypeKey,
      invoiceIds,
    }: {
      volunteerId: string;
      reimbursementTypeKey: ReimbursementTypeKey;
      invoiceIds?: string[];
    }) =>
      repository.recordBundleDownload(
        volunteerId,
        reimbursementTypeKey,
        invoiceIds,
      ),
    onSuccess: (_, { volunteerId, reimbursementTypeKey, invoiceIds }) => {
      queryClient.invalidateQueries({
        queryKey: [
          'accounting',
          'bundle-download-status',
          volunteerId,
          reimbursementTypeKey,
        ],
      });
      if (invoiceIds?.length) {
        invalidateInvoiceQueries(queryClient);
        for (const id of invoiceIds) {
          queryClient.invalidateQueries({
            queryKey: ['accounting', 'invoice', id],
          });
        }
      }
    },
  });
}

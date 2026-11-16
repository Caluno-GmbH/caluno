'use client';
import {
  AccountingRepository,
  type BundleRequest,
  type RawAccountingDeliverySettings,
  type RawBundleDelivery,
  type RawBundleSendPreview,
} from '@repo/data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BundleDeliveryIssue,
  UpdateAccountingDeliverySettingsInput,
} from '../../generated/base-types';
import { useSdk } from './use-graphql-client';
import { invalidateInvoiceQueries } from './use-invoices';
import { useMutation } from './use-mutation';

/** The header unit's delivery settings, so the key carries the unit. */
export function useAccountingDeliverySettings(organizationUnitId: string) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawAccountingDeliverySettings>({
    queryKey: ['accounting', 'delivery-settings', organizationUnitId],
    queryFn: () => repository.findAccountingDeliverySettings(),
    staleTime: 30 * 1000,
  });
}

export function useUpdateAccountingDeliverySettings(
  organizationUnitId: string,
) {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: (input: UpdateAccountingDeliverySettingsInput) =>
      repository.updateAccountingDeliverySettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        ['accounting', 'delivery-settings', organizationUnitId],
        settings,
      );
      // Sub-units inherit, so their cached settings may be stale too.
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'delivery-settings'],
      });
    },
  });
}

/**
 * Fetched on demand when the admin clicks "send", never cached: the issues
 * must be fresh for the confirmation.
 */
export function useBundleSendPreview() {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useMutation<RawBundleSendPreview, Error, BundleRequest>({
    mutationFn: (request) => repository.findBundleSendPreview(request),
  });
}

export function useSendReimbursementBundle() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new AccountingRepository(sdk);

  return useMutation({
    mutationFn: (
      request: BundleRequest & { acknowledgedIssues: BundleDeliveryIssue[] },
    ) => repository.sendReimbursementBundle(request),
    onSuccess: () => {
      invalidateInvoiceQueries(queryClient);
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'bundle-deliveries'],
      });
    },
  });
}

export function useBundleDeliveries(
  organizationUnitId: string,
  limit?: number,
  offset?: number,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawBundleDelivery[]>({
    queryKey: [
      'accounting',
      'bundle-deliveries',
      organizationUnitId,
      limit,
      offset,
    ],
    queryFn: () => repository.findBundleDeliveries({ limit, offset }),
    staleTime: 30 * 1000,
  });
}

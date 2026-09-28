'use client';
import {
  AccountingRepository,
  type RawVolunteerInviteAllowance,
  type RawVolunteerYearlyUsage,
  type RawYearlyUsage,
} from '@repo/data';
import { useQuery } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

/** A volunteer's usage for a coordinator; `excludeInvoiceId` leaves out the document being reissued or rendered. */
export function useYearlyUsage(input: {
  volunteerId?: string;
  reimbursementTypeId?: string;
  year?: number;
  /** ISO timestamp: only invoices whose period ended by then count. */
  asOfDate?: string;
  excludeInvoiceId?: string;
}) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawYearlyUsage>({
    // Nested under 'yearly-usage' so setting an initial amount refreshes it.
    queryKey: ['accounting', 'yearly-usage', input],
    queryFn: () =>
      repository.findYearlyUsage({
        volunteerId: input.volunteerId ?? '',
        reimbursementTypeId: input.reimbursementTypeId ?? '',
        year: input.year ?? 0,
        asOfDate: input.asOfDate,
        excludeInvoiceId: input.excludeInvoiceId,
      }),
    staleTime: 30 * 1000,
    enabled: !!input.volunteerId && !!input.reimbursementTypeId && !!input.year,
  });
}

export function useRosterYearlyUsage(
  organizationUnitId?: string,
  year?: number,
) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);

  return useQuery<RawVolunteerYearlyUsage[]>({
    queryKey: ['accounting', 'roster-usage', organizationUnitId, year],
    queryFn: () =>
      repository.findRosterYearlyUsage(organizationUnitId ?? '', year ?? 0),
    staleTime: 30 * 1000,
    enabled: !!organizationUnitId && !!year,
    refetchOnMount: 'always',
  });
}

/**
 * Per-volunteer allowance state for the "invite volunteers" list on a paid
 * shift (VOLI-1248). Only meaningful — and only enabled — when the shift is
 * paid under a known reimbursement type; an unpaid shift never enables this,
 * so its invite list is unaffected.
 */
export function useInviteAllowanceEligibility(input: {
  organizationUnitId?: string;
  reimbursementTypeId?: string;
  shiftDurationMinutes?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);
  const {
    organizationUnitId,
    reimbursementTypeId,
    shiftDurationMinutes,
    periodStart,
    periodEnd,
  } = input;

  return useQuery<RawVolunteerInviteAllowance[]>({
    queryKey: [
      'accounting',
      'invite-allowance-eligibility',
      organizationUnitId,
      reimbursementTypeId,
      shiftDurationMinutes,
      periodStart,
      periodEnd,
    ],
    queryFn: () =>
      repository.findInviteAllowanceEligibility({
        organizationUnitId: organizationUnitId ?? '',
        reimbursementTypeId: reimbursementTypeId ?? '',
        shiftDurationMinutes: shiftDurationMinutes ?? 0,
        periodStart,
        periodEnd,
      }),
    staleTime: 30 * 1000,
    enabled: Boolean(
      organizationUnitId && reimbursementTypeId && shiftDurationMinutes,
    ),
  });
}

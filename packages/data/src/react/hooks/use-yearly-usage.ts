'use client';
import {
  AccountingRepository,
  type RawVolunteerAllowance,
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
 * Per-volunteer allowance state (VOLI-1248), a property of the person: shown
 * in the invite list, the shift instance volunteer table and the volunteer
 * profile panel. Pass `shiftInstanceId` to measure against that shift;
 * without it the state describes the person only. Status signals only —
 * never amounts. The query fails when accounting is disabled or the caller
 * may not staff shifts, in which case there is simply no data to show.
 */
export function useVolunteerAllowanceStates(input: {
  volunteerIds: string[];
  shiftInstanceId?: string | null;
}) {
  const sdk = useSdk();
  const repository = new AccountingRepository(sdk);
  const { volunteerIds, shiftInstanceId } = input;

  return useQuery<RawVolunteerAllowance[]>({
    queryKey: [
      'accounting',
      'volunteer-allowance-states',
      shiftInstanceId ?? null,
      [...volunteerIds].sort(),
    ],
    queryFn: () =>
      repository.findVolunteerAllowanceStates({
        volunteerIds,
        shiftInstanceId,
      }),
    staleTime: 30 * 1000,
    retry: false,
    enabled: volunteerIds.length > 0,
  });
}

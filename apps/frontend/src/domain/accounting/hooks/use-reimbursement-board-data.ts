'use client';

import {
  useContracts,
  useInvoices,
  usePaidShiftSignupVolunteers,
  useRosterYearlyUsage,
  useVolunteersNeedingTimesheets,
} from '@repo/data/react';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import type { DateRange } from '../components/period-picker';
import { billingYearBounds } from '../lib/billing-period';
import { boardYear, buildBoardVolunteers } from '../lib/board-data.utils';
import { isBoardInitialLoad } from '../lib/board-loading';

interface UseReimbursementBoardDataInput {
  orgUId: string;
  dateRange?: DateRange;
  year?: number;
}

export function useReimbursementBoardData({
  orgUId,
  dateRange,
  year,
}: UseReimbursementBoardDataInput) {
  const locale = useLocale();
  const resolvedYear = year ?? boardYear(dateRange);

  const { periodStart, periodEnd } = useMemo(
    () => billingYearBounds(resolvedYear),
    [resolvedYear],
  );

  const rosterQuery = useRosterYearlyUsage(orgUId, resolvedYear);
  const contractsQuery = useContracts({
    periodStart,
    periodEnd,
  });
  const invoicesQuery = useInvoices({
    periodStart,
    periodEnd,
  });
  const needsTimesheetQuery = useVolunteersNeedingTimesheets({
    periodStart,
    periodEnd,
  });
  const paidShiftQuery = usePaidShiftSignupVolunteers(resolvedYear);

  const volunteers = useMemo(() => {
    if (!rosterQuery.data) return [];
    // Volunteer id -> reimbursement type ids they have eligible hours for.
    // Used to synthesize a `contract-generate` row when a volunteer has
    // eligible hours but no contract yet — see buildBoardVolunteers.
    const eligibleHoursVolunteers = new Map<string, Set<string>>();
    for (const entry of needsTimesheetQuery.data ?? []) {
      const types =
        eligibleHoursVolunteers.get(entry.volunteer.id) ?? new Set();
      types.add(entry.reimbursementType.id);
      eligibleHoursVolunteers.set(entry.volunteer.id, types);
    }
    // Volunteer id -> reimbursement type ids they signed up to a paid shift
    // for but have no contract/invoice yet.
    const paidShiftVolunteers = new Map<string, Set<string>>();
    for (const entry of paidShiftQuery.data ?? []) {
      const types = paidShiftVolunteers.get(entry.volunteer.id) ?? new Set();
      types.add(entry.reimbursementType.id);
      paidShiftVolunteers.set(entry.volunteer.id, types);
    }
    return buildBoardVolunteers({
      rosterUsage: rosterQuery.data,
      contracts: contractsQuery.data ?? [],
      invoices: invoicesQuery.data ?? [],
      year: resolvedYear,
      locale,
      dateRange,
      eligibleHoursVolunteers,
      paidShiftVolunteers,
      timesheetsToCreate: (needsTimesheetQuery.data ?? []).map((row) => ({
        volunteerId: row.volunteer.id,
        reimbursementTypeId: row.reimbursementType.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        eligibleHours: row.eligibleHours,
        estimatedAmountCents: row.estimatedAmountCents,
      })),
    });
  }, [
    rosterQuery.data,
    contractsQuery.data,
    invoicesQuery.data,
    needsTimesheetQuery.data,
    paidShiftQuery.data,
    resolvedYear,
    locale,
    dateRange,
  ]);

  return {
    volunteers,
    // Only the first load for this mount may blank the board out. A refetch
    // triggered by a mutation's invalidation must leave it standing — see
    // isBoardInitialLoad.
    isLoading: isBoardInitialLoad([
      rosterQuery,
      contractsQuery,
      invoicesQuery,
      needsTimesheetQuery,
      paidShiftQuery,
    ]),
    error:
      rosterQuery.error ??
      contractsQuery.error ??
      invoicesQuery.error ??
      needsTimesheetQuery.error ??
      paidShiftQuery.error,
  };
}

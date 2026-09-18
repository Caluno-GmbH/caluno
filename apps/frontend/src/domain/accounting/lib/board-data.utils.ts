import {
  ContractStatus,
  type ContractSummary,
  InvoiceStatus,
  type InvoiceSummary,
  PermissionKey,
  type RawVolunteerYearlyUsage,
  SigneeType,
} from '@repo/data';
import { formats } from '@/lib/formatting/formats';
import type { PauschalenType } from '../components/doc-type-header';
import type {
  BoardDocument,
  BoardVolunteer,
  DocStatus,
} from '../components/reimbursements-board';
import type { Signee, SigneeRole } from '../components/template/types';
import {
  billingMonthOf,
  contractPeriodKind,
  type DateInterval,
  isContractExpired,
  periodCovers,
} from './billing-period';
import { centsToEuros } from './money';
import { pauschaleForReimbursementTypeKey } from './reimbursement-type-mapping';

export type RawContract = ContractSummary;
export type RawInvoice = InvoiceSummary;
export type RawVolunteerUsage = RawVolunteerYearlyUsage;

export interface DocLineSummary {
  count: number;
  latest?: BoardDocument;
}

/**
 * How many of a volunteer's documents fall under a given "document line" (a
 * kind × pauschale pair) and which one is the most recently touched. Used by
 * the documents-creation flow to decide whether a document already exists for
 * that line or whether it should still prompt a "create" ("Not created yet").
 * A doc is counted for a line by its status prefix (`contract-*` for an
 * agreement, `timesheet-*` for a timesheet) matching the line's pauschale — so
 * a volunteer-signed timesheet awaiting countersignature (`timesheet-signing-super`)
 * counts as created, never as generate (VOLI-1283).
 */
export function getDocLineSummary(
  vol: BoardVolunteer,
  kind: 'contract' | 'invoice',
  pauschale: PauschalenType,
): DocLineSummary {
  const prefix = kind === 'contract' ? 'contract' : 'timesheet';
  const matches = vol.documents.filter(
    (d) =>
      (d.pauschale ?? vol.pauschale) === pauschale &&
      d.status.startsWith(prefix),
  );
  const latest = matches.reduce<BoardDocument | undefined>((acc, d) => {
    if (!acc) return d;
    const accDate = acc.lastActionDate?.getTime();
    const dDate = d.lastActionDate?.getTime();
    if (dDate === undefined) return acc;
    if (accDate === undefined) return d;
    return dDate > accDate ? d : acc;
  }, undefined);
  return { count: matches.length, latest };
}

export type DocumentRowAction = 'open' | 'create' | 'none';

/**
 * What a board row's body click should do. A timesheet still to create has no
 * persisted document — its row id is synthetic — so it opens the creation
 * modal rather than fetching an id that is not a UUID.
 */
export function documentRowAction(doc: BoardDocument): DocumentRowAction {
  if (doc.status === 'contract-generate') return 'none';
  if (doc.status === 'timesheet-generate') return 'create';
  return 'open';
}

export type CreationTarget = 'contract' | 'invoice';

/**
 * Which creation modal a row's "Preview and create" opens, or null once the
 * document is in its signing chain. An auto-queued DRAFT contract has no
 * signing chain yet, so it is created like a contract that was never drafted.
 */
export function creationTargetFor(status: DocStatus): CreationTarget | null {
  switch (status) {
    case 'contract-generate':
    case 'contract-draft':
    case 'contract-declined':
    case 'contract-missing':
    case 'contract-expired':
      return 'contract';
    case 'timesheet-generate':
    case 'timesheet-declined':
      return 'invoice';
    default:
      return null;
  }
}

export type ContractPickerState =
  | 'none'
  | 'awaiting-signature'
  | 'awaiting-countersignature'
  | 'active'
  | 'expired'
  | 'declined';

export interface PickerContractAnnotation {
  pauschale: PauschalenType;
  state: ContractPickerState;
}

export interface PickerAnnotations {
  contracts: PickerContractAnnotation[];
  latestTimesheetPeriod?: string;
}

const PICKER_PAUSCHALEN: PauschalenType[] = ['ehrenamt', 'uebungsleiter'];

/**
 * The timesheet states that represent an actually-issued document. Deliberately
 * excludes `timesheet-generate` (not created yet — including auto-queued rows
 * and drafts, which carry a period but no document), `timesheet-declined`
 * (declining releases the hours, VOLI-1245, so it is not a settled period) and
 * `timesheet-muted` (a paid-shift record with no document at all).
 */
const ISSUED_TIMESHEET_STATUSES = new Set<DocStatus>([
  'timesheet-signing-vol',
  'timesheet-signing-super',
  'timesheet-ready',
]);

export function getContractStateForPicker(
  vol: BoardVolunteer,
  pauschale: PauschalenType,
): ContractPickerState {
  const { latest } = getDocLineSummary(vol, 'contract', pauschale);
  switch (latest?.status) {
    case 'contract-active':
      return 'active';
    case 'contract-expired':
      return 'expired';
    case 'contract-declined':
      return 'declined';
    case 'contract-signing-coord':
      return 'awaiting-countersignature';
    case 'contract-draft':
    case 'contract-signing-vol':
      return 'awaiting-signature';
    default:
      return 'none';
  }
}

/**
 * The billing period the volunteer's most recent issued timesheet covers (e.g.
 * "August 2026"), or undefined when they have none. Deliberately keyed on the
 * document's covered period rather than a row timestamp: an invoice's
 * `updatedAt` moves for unrelated reasons (PDF render, payment, decline), so it
 * answers "when was this last touched", not "which months are settled". Ordered
 * by `periodStart` — the displayed value *is* the period, and this avoids the
 * created/signed/countersigned ambiguity entirely (VOLI-1339).
 */
export function getLatestTimesheetPeriod(
  vol: BoardVolunteer,
): string | undefined {
  const issued = vol.documents.filter((d) =>
    ISSUED_TIMESHEET_STATUSES.has(d.status),
  );
  const latest = issued.reduce<BoardDocument | undefined>((acc, d) => {
    if (!acc) return d;
    const accStart = (acc.periodStart ?? acc.periodEnd)?.getTime();
    const dStart = (d.periodStart ?? d.periodEnd)?.getTime();
    if (dStart === undefined) return acc;
    if (accStart === undefined) return d;
    return dStart > accStart ? d : acc;
  }, undefined);
  return latest?.periodLabel;
}

export function getPickerAnnotations(vol: BoardVolunteer): PickerAnnotations {
  return {
    contracts: PICKER_PAUSCHALEN.map((pauschale) => ({
      pauschale,
      state: getContractStateForPicker(vol, pauschale),
    })),
    latestTimesheetPeriod: getLatestTimesheetPeriod(vol),
  };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return `${first}${last ?? ''}`.toUpperCase();
}

export function contractStatusToDocStatus(status: ContractStatus): DocStatus {
  switch (status) {
    case ContractStatus.Draft:
      return 'contract-draft';
    case ContractStatus.AwaitingVolunteerSignature:
      return 'contract-signing-vol';
    case ContractStatus.AwaitingNgoSignature:
      return 'contract-signing-coord';
    case ContractStatus.Active:
      return 'contract-active';
    case ContractStatus.Expired:
      return 'contract-expired';
    case ContractStatus.Declined:
      return 'contract-declined';
    default:
      return 'contract-generate';
  }
}

export function invoiceStatusToDocStatus(status: InvoiceStatus): DocStatus {
  switch (status) {
    case InvoiceStatus.AwaitingVolunteerSignature:
      return 'timesheet-signing-vol';
    case InvoiceStatus.AwaitingSupervisorSignature:
      return 'timesheet-signing-super';
    case InvoiceStatus.Ready:
      return 'timesheet-ready';
    case InvoiceStatus.Declined:
      return 'timesheet-declined';
    default:
      return 'timesheet-generate';
  }
}

function signeeTypeToRole(
  signeeType: SigneeType,
  kind: 'contract' | 'invoice',
): SigneeRole {
  if (signeeType === SigneeType.Volunteer) return 'volunteer';
  return kind === 'contract' ? 'coordinator' : 'supervisor';
}

export function mapDeclinedAtRole(
  signeeType: SigneeType | null | undefined,
  kind: 'contract' | 'invoice',
): SigneeRole | undefined {
  if (!signeeType) return undefined;
  return signeeTypeToRole(signeeType, kind);
}

export function mapSignatureToSignee(
  signature:
    | RawContract['signatures'][number]
    | RawInvoice['signatures'][number],
  kind: 'contract' | 'invoice',
): Signee {
  const role = signeeTypeToRole(signature.signeeType, kind);
  return {
    id: signature.id,
    role,
    orgRole: {
      id: signature.requiredPermission?.id ?? `role-${role}`,
      name: signature.requiredPermission?.key ?? PermissionKey.AccountingManage,
    },
  };
}

export function mapContractToBoardDoc(
  contract: RawContract,
  type: PauschalenType,
  locale: string,
  referenceDate: Date = new Date(),
): BoardDocument {
  return {
    id: contract.id,
    status: effectiveContractDocStatus(contract, referenceDate),
    lastActionDate: new Date(contract.updatedAt ?? contract.createdAt),
    periodLabel: contractPeriodLabel(
      contract.periodStart,
      contract.periodEnd,
      locale,
    ),
    pauschale: type,
    declineReason: contract.declineReason ?? undefined,
    declinedBy: contract.declinedByUser?.name ?? undefined,
    declinedAt: contract.declinedAt ? new Date(contract.declinedAt) : undefined,
    declinedAtRole: mapDeclinedAtRole(
      contract.declinedAtSigneeType,
      'contract',
    ),
  };
}

/**
 * A contract is only valid for the period it states. Nothing moves an ACTIVE
 * row to EXPIRED yet (no expiry job), so an ACTIVE contract whose period has
 * already ended is shown as expired — it is complete, but not cover for the
 * current month (VOLI-1370).
 */
export function effectiveContractDocStatus(
  contract: RawContract,
  referenceDate: Date = new Date(),
): DocStatus {
  const status = contractStatusToDocStatus(contract.contractStatus);
  return status === 'contract-active' &&
    isContractExpired(
      contract.contractStatus,
      contract.periodEnd,
      referenceDate,
    )
    ? 'contract-expired'
    : status;
}

/**
 * The period a contract covers, as the agreement states it: "2026" for a
 * whole calendar year, "August 2026" for a single month, and a day range
 * otherwise. Previously every contract was labelled by its year regardless of
 * the stated Zeitraum (VOLI-1370).
 */
export function contractPeriodLabel(
  periodStart: Date | string,
  periodEnd: Date | string,
  locale: string,
): string {
  const kind = contractPeriodKind(periodStart, periodEnd);
  if (kind === 'year') {
    return String(billingMonthOf(periodStart).year);
  }
  if (kind === 'month') {
    return formatMonthYear(new Date(periodStart), locale);
  }
  return `${formats(locale).formatDate(new Date(periodStart))} – ${formats(
    locale,
  ).formatDate(new Date(new Date(periodEnd).getTime() - 1))}`;
}

export function mapInvoiceToBoardDoc(
  invoice: RawInvoice,
  type: PauschalenType,
  locale: string,
): BoardDocument {
  return {
    id: invoice.id,
    status: invoiceStatusToDocStatus(invoice.invoiceStatus),
    amount: centsToEuros(invoice.totalAmountCents),
    hours: invoice.totalHours,
    lastActionDate: new Date(invoice.updatedAt ?? invoice.createdAt),
    periodLabel: formatMonthYear(new Date(invoice.periodStart), locale),
    periodStart: new Date(invoice.periodStart),
    periodEnd: new Date(invoice.periodEnd),
    pauschale: type,
    declineReason: invoice.declineReason ?? undefined,
    declinedBy: invoice.declinedByUser?.name ?? undefined,
    declinedAt: invoice.declinedAt ? new Date(invoice.declinedAt) : undefined,
    declinedAtRole: mapDeclinedAtRole(invoice.declinedAtSigneeType, 'invoice'),
  };
}

export function contractPeriodOverlapsYear(
  contract: RawContract,
  year: number,
): boolean {
  // The end is exclusive: a contract ending 1 Jan doesn't reach into that year.
  const start = billingMonthOf(contract.periodStart).year;
  const end = billingMonthOf(
    new Date(new Date(contract.periodEnd).getTime() - 1),
  ).year;
  return start <= year && end >= year;
}

export function invoiceInMonth(
  invoice: RawInvoice,
  year: number,
  month: number,
): boolean {
  const start = billingMonthOf(invoice.periodStart);
  return start.year === year && start.month === month;
}

export function formatMonthYear(date: Date, locale: string): string {
  return formats(locale).formatDate(date, { month: 'long', year: 'numeric' });
}

export function monthsInRange(
  year: number,
  range?: { from?: Date; to?: Date },
): Array<{ year: number; month: number }> {
  if (!range?.from) {
    // All-time: every month of the selected year (boardYear falls back to the
    // current year when no range is set). Previously only the current month
    // was returned, so documents whose period fell in any other month never
    // surfaced — orphaning them from every stage (VOLI-1283).
    return Array.from({ length: 12 }, (_, month) => ({ year, month }));
  }
  const result: Array<{ year: number; month: number }> = [];
  const from = range.from;
  const to = range.to ?? from;
  let current = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (current <= end) {
    result.push({ year: current.getFullYear(), month: current.getMonth() });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return result;
}

/** A volunteer's unclaimed hours for one reimbursement type in one Berlin month (see `volunteersNeedingTimesheets`). */
export interface TimesheetToCreate {
  volunteerId: string;
  reimbursementTypeId: string;
  periodStart: string;
  periodEnd: string;
  eligibleHours: number;
  estimatedAmountCents: number;
}

/** A paid shift a volunteer joined whose month no open contract/invoice covers. */
export interface PaidShiftSignup {
  volunteerId: string;
  reimbursementTypeId: string;
  periodStart: string;
  periodEnd: string;
}

export interface BuildBoardVolunteersInput {
  rosterUsage: RawVolunteerUsage[];
  contracts: RawContract[];
  invoices: RawInvoice[];
  year: number;
  locale: string;
  dateRange?: { from?: Date; to?: Date };
  /**
   * Volunteer id -> the reimbursement type ids they still have eligible
   * (unclaimed, completed, in-period) time entries for. Used to synthesize a
   * `contract-generate` row when a volunteer has eligible hours but no
   * contract at all for that type yet.
   */
  eligibleHoursVolunteers?: ReadonlyMap<string, ReadonlySet<string>>;
  /** Paid-shift signups the backend found uncovered, each scoped to its month. */
  paidShiftSignups?: readonly PaidShiftSignup[];
  /**
   * Timesheets still to be created. Each becomes a `timesheet-generate` row
   * for its month showing the hours so far; entries are only claimed once the
   * coordinator issues the timesheet, so the row keeps adding up.
   */
  timesheetsToCreate?: readonly TimesheetToCreate[];
}

export function buildBoardVolunteers({
  rosterUsage,
  contracts,
  invoices,
  year,
  locale,
  dateRange,
  eligibleHoursVolunteers,
  paidShiftSignups = [],
  timesheetsToCreate = [],
}: BuildBoardVolunteersInput): BoardVolunteer[] {
  return rosterUsage.map((entry) => {
    const documents: BoardDocument[] = [];
    const limits: Partial<
      Record<PauschalenType, { used: number; total: number }>
    > = {};
    const reimbursementTypeIds: Partial<Record<PauschalenType, string>> = {};
    const volunteerTimesheetsToCreate = timesheetsToCreate.filter(
      (timesheet) => timesheet.volunteerId === entry.volunteer.id,
    );
    const volunteerPaidShiftSignups = paidShiftSignups.filter(
      (signup) => signup.volunteerId === entry.volunteer.id,
    );
    const eligibleTypeIds = new Set([
      ...(eligibleHoursVolunteers?.get(entry.volunteer.id) ?? []),
      ...volunteerTimesheetsToCreate.map((t) => t.reimbursementTypeId),
    ]);

    for (const usage of entry.usageByType) {
      const type = pauschaleForReimbursementTypeKey(
        usage.reimbursementType.key,
      );
      limits[type] = {
        used: centsToEuros(usage.usedCents),
        total: centsToEuros(usage.limitCents),
      };
      reimbursementTypeIds[type] = usage.reimbursementType.id;

      const contractsForType = contracts.filter(
        (c) =>
          c.volunteer.id === entry.volunteer.id &&
          c.reimbursementType.id === usage.reimbursementType.id &&
          contractPeriodOverlapsYear(c, year),
      );

      for (const contract of contractsForType) {
        documents.push(mapContractToBoardDoc(contract, type, locale));
      }

      const activeContract = contractsForType.find(
        (c) => c.contractStatus === ContractStatus.Active,
      );
      const timesheetsForType = volunteerTimesheetsToCreate.filter(
        (t) => t.reimbursementTypeId === usage.reimbursementType.id,
      );
      const paidShiftSignupsForType = volunteerPaidShiftSignups
        .filter((s) => s.reimbursementTypeId === usage.reimbursementType.id)
        .sort(
          (a, b) =>
            new Date(a.periodStart).getTime() -
            new Date(b.periodStart).getTime(),
        );
      // Months with eligible hours that no contract (other than a declined
      // one) covers. They get no timesheet row (no payment for an uncovered
      // period, VOLI-1370) but do surface a "create contract" reminder below.
      const uncoveredMonths: DateInterval[] = [];

      // An existing timesheet is a real document in the workflow and must be
      // tracked no matter what the contract currently is — it can be non-
      // compliant (no active contract, or the contract changed after the
      // timesheet was created), but it must never be orphaned out of every
      // stage (VOLI-1283).
      const months = monthsInRange(year, dateRange);
      for (const { year: y, month } of months) {
        const invoicesForMonth = invoices.filter(
          (i) =>
            i.volunteer.id === entry.volunteer.id &&
            i.reimbursementType.id === usage.reimbursementType.id &&
            invoiceInMonth(i, y, month),
        );
        for (const invoice of invoicesForMonth) {
          const doc = mapInvoiceToBoardDoc(invoice, type, locale);
          if (invoice.invoiceStatus !== InvoiceStatus.Declined) {
            const limit = limits[type];
            doc.isOverCap =
              limit !== undefined &&
              limit.used + centsToEuros(invoice.totalAmountCents) > limit.total;
          }
          documents.push(doc);
        }

        for (const timesheet of timesheetsForType) {
          const timesheetMonth = billingMonthOf(timesheet.periodStart);
          if (timesheetMonth.year !== y || timesheetMonth.month !== month) {
            continue;
          }
          const start = new Date(timesheet.periodStart);
          const end = new Date(timesheet.periodEnd);
          // Only a fully signed (ACTIVE) contract is valid cover: until both
          // parties have signed there is "no valid contract" for the period
          // (VOLI-1370). Drafts / awaiting-countersignature rows still surface
          // as their own contract task below, but they never release payment.
          if (
            !contractsForType.some(
              (c) =>
                c.contractStatus === ContractStatus.Active &&
                periodCovers(c.periodStart, c.periodEnd, start, end),
            )
          ) {
            uncoveredMonths.push({ start, end });
            continue;
          }
          documents.push({
            id: `${entry.volunteer.id}-timesheet-generate-${type}-${y}-${String(month + 1).padStart(2, '0')}`,
            status: 'timesheet-generate',
            pauschale: type,
            hours: timesheet.eligibleHours,
            amount: centsToEuros(timesheet.estimatedAmountCents),
            periodLabel: formatMonthYear(start, locale),
            periodStart: start,
            periodEnd: end,
          });
        }
      }

      // Eligible hours with no contract covering the month queue a "create
      // contract" row, so the missing Vereinbarung is visible instead of the
      // hours being silently attributed to an agreement for another period.
      if (
        eligibleTypeIds?.has(usage.reimbursementType.id) ||
        paidShiftSignupsForType.length > 0
      ) {
        // A month already covered by a draft / awaiting-signature contract is
        // that contract's own task (Create or Countersign) — don't synthesize a
        // second "create contract" row for it. Only a month with no contract
        // covering it at all gets the reminder.
        const firstUncovered = uncoveredMonths.find(
          (month) =>
            !contractsForType.some(
              (c) =>
                c.contractStatus !== ContractStatus.Declined &&
                periodCovers(
                  c.periodStart,
                  c.periodEnd,
                  month.start,
                  month.end,
                ),
            ),
        );
        if (firstUncovered) {
          documents.push({
            id: `${entry.volunteer.id}-contract-generate-${type}`,
            status: 'contract-generate',
            periodLabel: formatMonthYear(firstUncovered.start, locale),
            pauschale: type,
          });
        } else if (paidShiftSignupsForType.length > 0) {
          // The backend only returns paid-shift signups whose shift month no
          // open contract/invoice covers, each scoped to that month — so the
          // task names the month instead of the whole year (VOLI-1370).
          const signup = paidShiftSignupsForType[0];
          if (signup) {
            documents.push({
              id: `${entry.volunteer.id}-contract-generate-${type}`,
              status: 'contract-generate',
              periodLabel: formatMonthYear(
                new Date(signup.periodStart),
                locale,
              ),
              pauschale: type,
            });
          }
        } else if (
          timesheetsForType.length === 0 &&
          !activeContract &&
          contractsForType.length === 0
        ) {
          // No Vereinbarung exists at all yet — surface a real,
          // actionable "create contract" row (not the muted
          // contract-missing placeholder, which is reserved for
          // already-created documents whose paired contract vanished).
          documents.push({
            id: `${entry.volunteer.id}-contract-generate-${type}`,
            status: 'contract-generate',
            periodLabel: String(year),
            pauschale: type,
          });
        }
        // Else: a contract already exists but isn't active yet (awaiting
        // volunteer/coordinator signature, or declined) — the contract
        // document pushed above already queues this volunteer under
        // "Vereinbarungen gegenzeichnen" (or the declined-document flow),
        // so nothing further needs synthesizing here.
      }
    }

    const primaryType =
      (entry.usageByType[0]?.reimbursementType.key
        ? pauschaleForReimbursementTypeKey(
            entry.usageByType[0].reimbursementType.key,
          )
        : undefined) ?? 'ehrenamt';

    return {
      id: entry.volunteer.id,
      name: entry.volunteer.name,
      initials: getInitials(entry.volunteer.name),
      pauschale: primaryType,
      usedAmount: centsToEuros(
        entry.usageByType.reduce((sum, u) => sum + u.usedCents, 0),
      ),
      totalCap: centsToEuros(
        entry.usageByType.reduce((sum, u) => sum + u.limitCents, 0),
      ),
      limits,
      reimbursementTypeIds,
      documents,
    };
  });
}

export function boardYear(dateRange?: { from?: Date; to?: Date }): number {
  const now = new Date();
  return (
    dateRange?.from?.getFullYear() ??
    dateRange?.to?.getFullYear() ??
    now.getFullYear()
  );
}

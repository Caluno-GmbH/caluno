import { DocumentKind } from '../../accounting/enums';
import { PermissionKey } from '../../auth/enums';
import { TaskType } from '../enums/task-type.enum';
import type { Task } from '../models/task.model';

export interface ContractTaskRow {
  id: string;
  volunteerId: string;
  volunteerName: string;
  reimbursementTypeKey: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  declinedAtSigneeType: string | null;
  declineReason: string | null;
  declinedAt: Date | null;
  volunteerSignedAt: Date | null;
}

export interface InvoiceTaskRow extends ContractTaskRow {
  totalHours: number;
  totalAmountCents: number;
  paidAt: Date | null;
}

/** A timesheet still to create — same shape the reimbursements board uses. */
export interface TimesheetCreateRow {
  volunteerId: string;
  volunteerName: string;
  reimbursementTypeId: string;
  reimbursementTypeKey: string;
  periodStart: Date;
  periodEnd: Date;
  eligibleHours: number;
  estimatedAmountCents: number;
  hasUncoveredHours: boolean;
  firstUncoveredAt: Date | null;
}

/** Paid-shift signup with no open contract/invoice cover for that month. */
export interface PaidShiftSignupRow {
  volunteerId: string;
  volunteerName: string;
  reimbursementTypeId: string;
  reimbursementTypeKey: string;
  periodStart: Date;
  periodEnd: Date;
}

export function countersignContractTasks(
  rows: ContractTaskRow[],
  organizationUnitId: string,
): Task[] {
  return rows
    .filter((row) => row.status === 'AWAITING_NGO_SIGNATURE')
    .map((row) =>
      documentTask(
        row,
        TaskType.CONTRACT_SIGN,
        organizationUnitId,
        PermissionKey.ACCOUNTING_MANAGE,
      ),
    );
}

export function timesheetSignTasks(
  rows: InvoiceTaskRow[],
  organizationUnitId: string,
): Task[] {
  return rows
    .filter((row) => row.status === 'AWAITING_SUPERVISOR_SIGNATURE')
    .map((row) => ({
      ...documentTask(
        row,
        TaskType.TIMESHEET_SIGN,
        organizationUnitId,
        PermissionKey.ACCOUNTING_MANAGE,
      ),
      data: {
        volunteerName: row.volunteerName,
        reimbursementTypeKey: row.reimbursementTypeKey,
        periodStart: row.periodStart.toISOString(),
        periodEnd: row.periodEnd.toISOString(),
        hours: row.totalHours,
        amountCents: row.totalAmountCents,
        signedAt: iso(row.volunteerSignedAt),
      },
    }));
}

/** One card per volunteer and reimbursement type, counting every unpaid READY timesheet. */
export function timesheetBundleTasks(
  rows: InvoiceTaskRow[],
  organizationUnitId: string,
): Task[] {
  const groups = new Map<
    string,
    {
      volunteerId: string;
      volunteerName: string;
      reimbursementTypeKey: string;
      count: number;
      amountCents: number;
    }
  >();

  for (const row of rows) {
    if (row.status !== 'READY' || row.paidAt) continue;
    const key = `${row.volunteerId}|${row.reimbursementTypeKey}`;
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      group.amountCents += row.totalAmountCents;
    } else {
      groups.set(key, {
        volunteerId: row.volunteerId,
        volunteerName: row.volunteerName,
        reimbursementTypeKey: row.reimbursementTypeKey,
        count: 1,
        amountCents: row.totalAmountCents,
      });
    }
  }

  return [...groups.values()].map((group) => ({
    id: `bundle:${group.volunteerId}:${group.reimbursementTypeKey}`,
    type: TaskType.TIMESHEET_BUNDLES,
    link: reimbursementsLink(organizationUnitId),
    organizationUnitId,
    neededPermission: PermissionKey.ACCOUNTING_MANAGE,
    data: {
      volunteerName: group.volunteerName,
      reimbursementTypeKey: group.reimbursementTypeKey,
      readyCount: group.count,
      amountCents: group.amountCents,
    },
  }));
}

/** Auto-queued DRAFT agreements — board tile "Create agreements" / contract-draft. */
export function createContractDraftTasks(
  rows: ContractTaskRow[],
  organizationUnitId: string,
): Task[] {
  return rows
    .filter((row) => row.status === 'DRAFT')
    .map((row) =>
      documentTask(
        row,
        TaskType.CONTRACT_CREATE,
        organizationUnitId,
        PermissionKey.ACCOUNTING_MANAGE,
      ),
    );
}

/**
 * Synthesized "create agreement" reminders — board contract-generate.
 * One card per volunteer + reimbursement type (earliest uncovered month wins).
 * OPEN cover (draft / awaiting signature) already clears `hasUncoveredHours`;
 * a draft for another period does not, and both cards can show — same as the board.
 */
export function createContractGenerateTasks(
  timesheets: TimesheetCreateRow[],
  paidShiftSignups: PaidShiftSignupRow[],
  organizationUnitId: string,
): Task[] {
  const byPair = new Map<
    string,
    {
      volunteerId: string;
      volunteerName: string;
      reimbursementTypeKey: string;
      periodStart: Date;
      periodEnd: Date;
      sortAt: number;
    }
  >();

  const consider = (
    volunteerId: string,
    volunteerName: string,
    reimbursementTypeId: string,
    reimbursementTypeKey: string,
    periodStart: Date,
    periodEnd: Date,
    sortAt: number,
  ) => {
    const pair = `${volunteerId}|${reimbursementTypeId}`;
    const existing = byPair.get(pair);
    if (existing && existing.sortAt <= sortAt) return;
    byPair.set(pair, {
      volunteerId,
      volunteerName,
      reimbursementTypeKey,
      periodStart,
      periodEnd,
      sortAt,
    });
  };

  const uncoveredByPair = new Map<string, TimesheetCreateRow[]>();
  for (const row of timesheets) {
    if (!row.hasUncoveredHours) continue;
    const pair = `${row.volunteerId}|${row.reimbursementTypeId}`;
    const list = uncoveredByPair.get(pair) ?? [];
    list.push(row);
    uncoveredByPair.set(pair, list);
  }
  for (const rows of uncoveredByPair.values()) {
    rows.sort(
      (a, b) =>
        (a.firstUncoveredAt ?? a.periodStart).getTime() -
        (b.firstUncoveredAt ?? b.periodStart).getTime(),
    );
    const first = rows[0];
    if (!first) continue;
    consider(
      first.volunteerId,
      first.volunteerName,
      first.reimbursementTypeId,
      first.reimbursementTypeKey,
      first.periodStart,
      first.periodEnd,
      (first.firstUncoveredAt ?? first.periodStart).getTime(),
    );
  }

  const signupByPair = new Map<string, PaidShiftSignupRow[]>();
  for (const row of paidShiftSignups) {
    const pair = `${row.volunteerId}|${row.reimbursementTypeId}`;
    if (uncoveredByPair.has(pair)) continue;
    const list = signupByPair.get(pair) ?? [];
    list.push(row);
    signupByPair.set(pair, list);
  }
  for (const rows of signupByPair.values()) {
    rows.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
    const first = rows[0];
    if (!first) continue;
    consider(
      first.volunteerId,
      first.volunteerName,
      first.reimbursementTypeId,
      first.reimbursementTypeKey,
      first.periodStart,
      first.periodEnd,
      first.periodStart.getTime(),
    );
  }

  return [...byPair.values()].map((row) => ({
    id: `contract-generate:${row.volunteerId}:${row.reimbursementTypeKey}`,
    type: TaskType.CONTRACT_CREATE,
    link: reimbursementsLink(organizationUnitId),
    organizationUnitId,
    neededPermission: PermissionKey.ACCOUNTING_MANAGE,
    data: {
      volunteerName: row.volunteerName,
      reimbursementTypeKey: row.reimbursementTypeKey,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      kind: 'generate',
    },
  }));
}

/** Unclaimed paid hours by volunteer, type, and Berlin month — board timesheet-generate. */
export function createInvoiceTasks(
  rows: TimesheetCreateRow[],
  organizationUnitId: string,
): Task[] {
  return rows.map((row) => ({
    id: `invoice-create:${row.volunteerId}:${row.reimbursementTypeKey}:${row.periodStart.toISOString()}`,
    type: TaskType.INVOICE_CREATE,
    link: reimbursementsLink(organizationUnitId),
    organizationUnitId,
    neededPermission: PermissionKey.ACCOUNTING_MANAGE,
    data: {
      volunteerName: row.volunteerName,
      reimbursementTypeKey: row.reimbursementTypeKey,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      hours: row.eligibleHours,
      amountCents: row.estimatedAmountCents,
    },
  }));
}

/**
 * Volunteer-declined documents only. A later document for the same volunteer,
 * reimbursement type, and period replaces the card. Org declines stay off.
 */
export function declinedDocumentTasks(
  rows: ContractTaskRow[],
  organizationUnitId: string,
  kind: DocumentKind,
): Task[] {
  const replaced = new Set(
    rows.filter((row) => row.status !== 'DECLINED').map(periodKey),
  );

  return rows
    .filter(
      (row) =>
        row.status === 'DECLINED' &&
        row.declinedAtSigneeType === 'VOLUNTEER' &&
        !replaced.has(periodKey(row)),
    )
    .map((row) => ({
      ...documentTask(
        row,
        TaskType.DOCUMENT_DECLINED,
        organizationUnitId,
        PermissionKey.ACCOUNTING_MANAGE,
      ),
      data: {
        volunteerName: row.volunteerName,
        reimbursementTypeKey: row.reimbursementTypeKey,
        periodStart: row.periodStart.toISOString(),
        periodEnd: row.periodEnd.toISOString(),
        declineReason: row.declineReason,
        declinedAtSigneeType: row.declinedAtSigneeType,
        declinedAt: iso(row.declinedAt),
        kind,
      },
    }));
}

function documentTask(
  row: ContractTaskRow,
  type: TaskType,
  organizationUnitId: string,
  neededPermission: PermissionKey,
): Task {
  return {
    id: row.id,
    type,
    link: reimbursementsLink(organizationUnitId),
    organizationUnitId,
    neededPermission,
    data: {
      volunteerName: row.volunteerName,
      reimbursementTypeKey: row.reimbursementTypeKey,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      signedAt: iso(row.volunteerSignedAt),
    },
  };
}

function periodKey(row: ContractTaskRow): string {
  return `${row.volunteerId}|${row.reimbursementTypeKey}|${row.periodStart.getTime()}|${row.periodEnd.getTime()}`;
}

function iso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function reimbursementsLink(organizationUnitId: string): string {
  return `/admin/${organizationUnitId}/accounting/reimbursements`;
}

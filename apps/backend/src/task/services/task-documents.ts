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

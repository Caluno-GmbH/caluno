import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
} from '../../accounting/enums';
import { AuthService } from '../../auth/auth.service';
import { PermissionKey } from '../../auth/enums';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import { EventInviteStatus } from '../../event/enums';
import { MembershipRequestStatus } from '../../membership/enums';
import { ShiftInviteStatus } from '../../shift/enums';
import { TaskType } from '../enums/task-type.enum';
import { Task } from '../models/task.model';
import {
  type ContractTaskRow,
  countersignContractTasks,
  declinedDocumentTasks,
  type InvoiceTaskRow,
  timesheetBundleTasks,
  timesheetSignTasks,
} from './task-documents';

/**
 * Tasks are computed on each read for the selected org unit. A row leaves
 * the list once anyone handles it. Sub-units are not included.
 */
@Injectable()
export class TaskService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly authService: AuthService,
  ) {}

  async myTasks(userId: string, organizationUnitId: string): Promise<Task[]> {
    const permissions = await this.authService.findUserPermissionKeys(
      userId,
      organizationUnitId,
    );
    const canEditShifts = permissions.has(PermissionKey.SHIFT_EDIT);
    const canEditVolunteers = permissions.has(PermissionKey.VOLUNTEER_EDIT);
    const canManageAccounting = permissions.has(
      PermissionKey.ACCOUNTING_MANAGE,
    );

    const [
      belowMinimum,
      shiftApprovals,
      eventApprovals,
      membershipRequests,
      contracts,
      invoices,
    ] = await Promise.all([
      canEditShifts ? this.shiftsBelowMinimum(organizationUnitId) : [],
      canEditShifts ? this.shiftApprovals(organizationUnitId) : [],
      canEditShifts ? this.eventApprovals(organizationUnitId) : [],
      canEditVolunteers ? this.membershipRequests(organizationUnitId) : [],
      canManageAccounting ? this.contractRows(organizationUnitId) : [],
      canManageAccounting ? this.invoiceRows(organizationUnitId) : [],
    ]);

    return [
      ...belowMinimum,
      ...shiftApprovals,
      ...eventApprovals,
      ...countersignContractTasks(contracts, organizationUnitId),
      ...timesheetSignTasks(invoices, organizationUnitId),
      ...timesheetBundleTasks(invoices, organizationUnitId),
      ...declinedDocumentTasks(
        contracts,
        organizationUnitId,
        DocumentKind.CONTRACT,
      ),
      ...declinedDocumentTasks(
        invoices,
        organizationUnitId,
        DocumentKind.INVOICE,
      ),
      ...membershipRequests,
    ];
  }

  private async shiftsBelowMinimum(
    organizationUnitId: string,
  ): Promise<Task[]> {
    const minimum = sql<number>`coalesce(${schema.shiftInstances.overrideMinVolunteers}, ${schema.shifts.minVolunteers})`;
    const approvedCount = sql<number>`count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.JOINED})::int`;
    const title = sql<string>`coalesce(${schema.shiftInstances.overrideTitle}, ${schema.shifts.title})`;

    const rows = await this.db
      .select({
        instanceId: schema.shiftInstances.id,
        shiftId: schema.shifts.id,
        title,
        startsAt: schema.shiftInstances.actualStartsAt,
        endsAt: schema.shiftInstances.actualEndsAt,
        minimum,
        approvedCount,
      })
      .from(schema.shiftInstances)
      .innerJoin(
        schema.shifts,
        eq(schema.shiftInstances.masterId, schema.shifts.id),
      )
      .leftJoin(
        schema.shiftInstanceInvites,
        eq(schema.shiftInstanceInvites.instanceId, schema.shiftInstances.id),
      )
      .where(
        and(
          eq(schema.shifts.organizationUnitId, organizationUnitId),
          eq(schema.shifts.isDeleted, false),
          eq(schema.shiftInstances.isCancelled, false),
          gt(schema.shiftInstances.actualEndsAt, new Date()),
        ),
      )
      .groupBy(
        schema.shiftInstances.id,
        schema.shifts.id,
        schema.shiftInstances.overrideTitle,
        schema.shifts.title,
        schema.shiftInstances.actualStartsAt,
        schema.shiftInstances.actualEndsAt,
        schema.shiftInstances.overrideMinVolunteers,
        schema.shifts.minVolunteers,
      )
      .having(
        sql`coalesce(${schema.shiftInstances.overrideMinVolunteers}, ${schema.shifts.minVolunteers}) is not null and count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.JOINED}) < coalesce(${schema.shiftInstances.overrideMinVolunteers}, ${schema.shifts.minVolunteers})`,
      )
      .orderBy(asc(schema.shiftInstances.actualStartsAt));

    return rows.map((row) => ({
      id: row.instanceId,
      type: TaskType.SHIFT_BELOW_MINIMUM,
      link: `/admin/${organizationUnitId}/shifts/${row.shiftId}/instances/${row.instanceId}`,
      organizationUnitId,
      neededPermission: PermissionKey.SHIFT_EDIT,
      data: {
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        approvedCount: Number(row.approvedCount),
        minimum: Number(row.minimum),
      },
    }));
  }

  private async shiftApprovals(organizationUnitId: string): Promise<Task[]> {
    const openRequestCount = sql<number>`count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.AWAITING_ADMIN_APPROVAL})::int`;
    const title = sql<string>`coalesce(${schema.shiftInstances.overrideTitle}, ${schema.shifts.title})`;

    const rows = await this.db
      .select({
        instanceId: schema.shiftInstances.id,
        shiftId: schema.shifts.id,
        title,
        startsAt: schema.shiftInstances.actualStartsAt,
        endsAt: schema.shiftInstances.actualEndsAt,
        openRequestCount,
      })
      .from(schema.shiftInstances)
      .innerJoin(
        schema.shifts,
        eq(schema.shiftInstances.masterId, schema.shifts.id),
      )
      .innerJoin(
        schema.shiftInstanceInvites,
        eq(schema.shiftInstanceInvites.instanceId, schema.shiftInstances.id),
      )
      .where(
        and(
          eq(schema.shifts.organizationUnitId, organizationUnitId),
          eq(schema.shifts.isDeleted, false),
          eq(schema.shiftInstances.isCancelled, false),
        ),
      )
      .groupBy(
        schema.shiftInstances.id,
        schema.shifts.id,
        schema.shiftInstances.overrideTitle,
        schema.shifts.title,
        schema.shiftInstances.actualStartsAt,
        schema.shiftInstances.actualEndsAt,
      )
      .having(
        sql`count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.AWAITING_ADMIN_APPROVAL}) > 0`,
      )
      .orderBy(asc(schema.shiftInstances.actualStartsAt));

    return rows.map((row) => ({
      id: row.instanceId,
      type: TaskType.SHIFT_APPROVAL,
      link: `/admin/${organizationUnitId}/shifts/${row.shiftId}/instances/${row.instanceId}`,
      organizationUnitId,
      neededPermission: PermissionKey.SHIFT_EDIT,
      data: {
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        openRequestCount: Number(row.openRequestCount),
      },
    }));
  }

  private async eventApprovals(organizationUnitId: string): Promise<Task[]> {
    const openRequestCount = sql<number>`count(*) filter (where ${schema.eventInvites.status} = ${EventInviteStatus.AWAITING_ADMIN_APPROVAL})::int`;

    const rows = await this.db
      .select({
        eventId: schema.events.id,
        title: schema.events.title,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        openRequestCount,
      })
      .from(schema.events)
      .innerJoin(
        schema.eventInvites,
        eq(schema.eventInvites.eventId, schema.events.id),
      )
      .where(
        and(
          eq(schema.events.organizationUnitId, organizationUnitId),
          eq(schema.events.isDeleted, false),
        ),
      )
      .groupBy(
        schema.events.id,
        schema.events.title,
        schema.events.startsAt,
        schema.events.endsAt,
      )
      .having(
        sql`count(*) filter (where ${schema.eventInvites.status} = ${EventInviteStatus.AWAITING_ADMIN_APPROVAL}) > 0`,
      )
      .orderBy(asc(schema.events.startsAt));

    return rows.map((row) => ({
      id: row.eventId,
      type: TaskType.EVENT_APPROVAL,
      link: `/admin/${organizationUnitId}/events/${row.eventId}`,
      organizationUnitId,
      neededPermission: PermissionKey.SHIFT_EDIT,
      data: {
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        openRequestCount: Number(row.openRequestCount),
      },
    }));
  }

  private async membershipRequests(
    organizationUnitId: string,
  ): Promise<Task[]> {
    const rows = await this.db.query.membershipRequests.findMany({
      where: {
        organizationUnitId,
        status: MembershipRequestStatus.PENDING,
      },
      with: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.flatMap((row) => {
      if (!row.user) return [];
      return [
        {
          id: row.id,
          type: TaskType.MEMBERSHIP_REQUEST,
          link: `/admin/${organizationUnitId}/volunteers?status=${MembershipRequestStatus.PENDING}`,
          organizationUnitId,
          neededPermission: PermissionKey.VOLUNTEER_EDIT,
          data: {
            firstName: row.user.firstname,
            lastName: row.user.lastname,
            requestedAt: row.createdAt.toISOString(),
          },
        },
      ];
    });
  }

  private async contractRows(
    organizationUnitId: string,
  ): Promise<ContractTaskRow[]> {
    const rows = await this.db
      .select({
        id: schema.contracts.id,
        volunteerId: schema.contracts.volunteerId,
        volunteerName: schema.users.name,
        reimbursementTypeKey: schema.reimbursementTypes.key,
        periodStart: schema.contracts.periodStart,
        periodEnd: schema.contracts.periodEnd,
        status: schema.contracts.contractStatus,
        declinedAtSigneeType: schema.contracts.declinedAtSigneeType,
        declineReason: schema.contracts.declineReason,
      })
      .from(schema.contracts)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.contracts.volunteerId),
      )
      .innerJoin(
        schema.reimbursementTypes,
        eq(schema.reimbursementTypes.id, schema.contracts.reimbursementTypeId),
      )
      .where(
        and(
          eq(schema.contracts.organizationUnitId, organizationUnitId),
          inArray(schema.contracts.contractStatus, [
            ContractStatus.AWAITING_NGO_SIGNATURE,
            ContractStatus.DECLINED,
            ContractStatus.DRAFT,
            ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
            ContractStatus.ACTIVE,
          ]),
        ),
      );

    return rows.map((row) => ({
      ...row,
      declinedAtSigneeType: row.declinedAtSigneeType,
      declineReason: row.declineReason,
    }));
  }

  private async invoiceRows(
    organizationUnitId: string,
  ): Promise<InvoiceTaskRow[]> {
    const rows = await this.db
      .select({
        id: schema.invoices.id,
        volunteerId: schema.invoices.volunteerId,
        volunteerName: schema.users.name,
        reimbursementTypeKey: schema.reimbursementTypes.key,
        periodStart: schema.invoices.periodStart,
        periodEnd: schema.invoices.periodEnd,
        status: schema.invoices.invoiceStatus,
        declinedAtSigneeType: schema.invoices.declinedAtSigneeType,
        declineReason: schema.invoices.declineReason,
        totalHours: schema.invoices.totalHours,
        totalAmountCents: schema.invoices.totalAmountCents,
        paidAt: schema.invoices.paidAt,
      })
      .from(schema.invoices)
      .innerJoin(schema.users, eq(schema.users.id, schema.invoices.volunteerId))
      .innerJoin(
        schema.reimbursementTypes,
        eq(schema.reimbursementTypes.id, schema.invoices.reimbursementTypeId),
      )
      .where(
        and(
          eq(schema.invoices.organizationUnitId, organizationUnitId),
          inArray(schema.invoices.invoiceStatus, [
            InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
            InvoiceStatus.READY,
            InvoiceStatus.DECLINED,
            InvoiceStatus.DRAFT,
            InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE,
          ]),
        ),
      );

    return rows.map((row) => ({
      ...row,
      declinedAtSigneeType: row.declinedAtSigneeType ?? null,
      declineReason: row.declineReason,
      paidAt: row.paidAt,
    }));
  }
}

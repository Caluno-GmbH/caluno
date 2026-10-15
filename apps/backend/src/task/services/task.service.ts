import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  max,
  sql,
} from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  SigneeType,
} from '../../accounting/enums';
import { InvoiceService } from '../../accounting/services/invoice.service';
import { ReimbursementRateService } from '../../accounting/services/reimbursement-rate.service';
import {
  billingYearBounds,
  billingYearOf,
} from '../../accounting/utils/billing-period';
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
  createContractDraftTasks,
  createContractGenerateTasks,
  createInvoiceTasks,
  declinedDocumentTasks,
  type InvoiceTaskRow,
  type PaidShiftSignupRow,
  type TimesheetCreateRow,
  timesheetBundleTasks,
  timesheetSignTasks,
} from './task-documents';
import {
  type FillAssignmentFilter,
  fillAssignmentWindow,
} from './todo-fill-filter';
import { TodoFillFilterService } from './todo-fill-filter.service';

const shiftInstanceTitle = sql<string>`coalesce(${schema.shiftInstances.overrideTitle}, ${schema.shifts.title})`;
const shiftMinimumVolunteers = sql<number>`coalesce(${schema.shiftInstances.overrideMinVolunteers}, ${schema.shifts.minVolunteers})`;
const shiftMaximumVolunteers = sql<
  number | null
>`coalesce(${schema.shiftInstances.overrideMaxVolunteers}, ${schema.shifts.maxVolunteers})`;
const joinedInviteCount = sql<number>`count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.JOINED})::int`;
const shiftOpenApprovalCount = sql<number>`count(*) filter (where ${schema.shiftInstanceInvites.status} = ${ShiftInviteStatus.AWAITING_ADMIN_APPROVAL})::int`;
const eventOpenApprovalCount = sql<number>`count(*) filter (where ${schema.eventInvites.status} = ${EventInviteStatus.AWAITING_ADMIN_APPROVAL})::int`;

/**
 * Tasks are computed on each read for the selected org unit. A row leaves
 * the list once anyone handles it. Sub-units are not included.
 */
@Injectable()
export class TaskService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly authService: AuthService,
    private readonly fillFilters: TodoFillFilterService,
    private readonly invoiceService: InvoiceService,
    private readonly reimbursementRateService: ReimbursementRateService,
  ) {}

  async myTasks(userId: string, organizationUnitId: string): Promise<Task[]> {
    const [permissions, fillFilter] = await Promise.all([
      this.authService.findUserPermissionKeys(userId, organizationUnitId),
      this.fillFilters.get(userId, organizationUnitId),
    ]);
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
      timesheetsToCreate,
      paidShiftSignups,
    ] = await Promise.all([
      canEditShifts
        ? this.shiftsBelowMinimum(organizationUnitId, fillFilter)
        : [],
      canEditShifts ? this.shiftApprovals(organizationUnitId) : [],
      canEditShifts ? this.eventApprovals(organizationUnitId) : [],
      canEditVolunteers ? this.membershipRequests(organizationUnitId) : [],
      canManageAccounting ? this.contractRows(organizationUnitId) : [],
      canManageAccounting ? this.invoiceRows(organizationUnitId) : [],
      canManageAccounting ? this.timesheetCreateRows(organizationUnitId) : [],
      canManageAccounting ? this.paidShiftSignupRows(organizationUnitId) : [],
    ]);

    return [
      ...belowMinimum,
      ...shiftApprovals,
      ...eventApprovals,
      ...createContractDraftTasks(contracts, organizationUnitId),
      ...createContractGenerateTasks(
        timesheetsToCreate,
        paidShiftSignups,
        organizationUnitId,
      ),
      ...createInvoiceTasks(timesheetsToCreate, organizationUnitId),
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

  /**
   * Same rows as `volunteersNeedingTimesheets` for the current Berlin year,
   * enriched for task cards (name, type key, estimated amount).
   */
  private async timesheetCreateRows(
    organizationUnitId: string,
  ): Promise<TimesheetCreateRow[]> {
    const year = billingYearOf(new Date());
    const { start, end } = billingYearBounds(year);
    const rows = await this.invoiceService.findVolunteersNeedingTimesheets(
      organizationUnitId,
      start,
      end,
    );
    if (rows.length === 0) return [];

    const volunteerIds = [...new Set(rows.map((row) => row.volunteerId))];
    const typeIds = [...new Set(rows.map((row) => row.reimbursementTypeId))];

    const unit = await this.db.query.organizationUnits.findFirst({
      where: { id: organizationUnitId },
      columns: { organizationId: true },
    });
    if (!unit) return [];

    const [users, types, rates] = await Promise.all([
      this.db.query.users.findMany({
        where: { id: { in: volunteerIds } },
        columns: { id: true, name: true },
      }),
      this.db.query.reimbursementTypes.findMany({
        where: { id: { in: typeIds } },
        columns: {
          id: true,
          key: true,
          platformDefaultRateCents: true,
        },
      }),
      this.reimbursementRateService.getEffectiveRates(
        unit.organizationId,
        organizationUnitId,
      ),
    ]);

    const nameById = new Map(users.map((user) => [user.id, user.name]));
    const typeById = new Map(types.map((type) => [type.id, type]));
    const rateByTypeId = new Map(
      rates.map((rate) => [rate.reimbursementType.id, rate.hourlyRateCents]),
    );

    return rows.flatMap((row) => {
      const type = typeById.get(row.reimbursementTypeId);
      const volunteerName = nameById.get(row.volunteerId);
      if (!type || !volunteerName) return [];
      const rateCents =
        rateByTypeId.get(row.reimbursementTypeId) ??
        type.platformDefaultRateCents;
      return [
        {
          volunteerId: row.volunteerId,
          volunteerName,
          reimbursementTypeId: row.reimbursementTypeId,
          reimbursementTypeKey: type.key,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          eligibleHours: row.eligibleHours,
          estimatedAmountCents: Math.round(row.eligibleHours * rateCents),
          hasUncoveredHours: row.hasUncoveredHours,
          firstUncoveredAt: row.firstUncoveredAt,
        },
      ];
    });
  }

  /**
   * Paid-shift signups with no open contract/invoice covering the shift
   * month — delegates to `InvoiceService.findPaidShiftSignupVolunteers`,
   * then enriches with volunteer name and reimbursement type key for cards.
   */
  private async paidShiftSignupRows(
    organizationUnitId: string,
  ): Promise<PaidShiftSignupRow[]> {
    const year = billingYearOf(new Date());
    const rows = await this.invoiceService.findPaidShiftSignupVolunteers(
      organizationUnitId,
      year,
    );
    if (rows.length === 0) return [];

    const volunteerIds = [...new Set(rows.map((row) => row.volunteerId))];
    const typeIds = [...new Set(rows.map((row) => row.reimbursementTypeId))];

    const [users, types] = await Promise.all([
      this.db.query.users.findMany({
        where: { id: { in: volunteerIds } },
        columns: { id: true, name: true },
      }),
      this.db.query.reimbursementTypes.findMany({
        where: { id: { in: typeIds } },
        columns: { id: true, key: true },
      }),
    ]);

    const nameById = new Map(users.map((user) => [user.id, user.name]));
    const typeKeyById = new Map(types.map((type) => [type.id, type.key]));

    return rows.flatMap((row) => {
      const volunteerName = nameById.get(row.volunteerId);
      const reimbursementTypeKey = typeKeyById.get(row.reimbursementTypeId);
      if (!volunteerName || !reimbursementTypeKey) return [];
      return [
        {
          volunteerId: row.volunteerId,
          volunteerName,
          reimbursementTypeId: row.reimbursementTypeId,
          reimbursementTypeKey,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        },
      ];
    });
  }

  private async shiftsBelowMinimum(
    organizationUnitId: string,
    filter: FillAssignmentFilter,
  ): Promise<Task[]> {
    const now = new Date();
    const window = fillAssignmentWindow(now, filter.daysAhead);
    const staffing =
      filter.threshold === 'NOT_FULL'
        ? and(
            isNotNull(shiftMaximumVolunteers),
            lt(joinedInviteCount, shiftMaximumVolunteers),
          )
        : and(
            isNotNull(shiftMinimumVolunteers),
            lt(joinedInviteCount, shiftMinimumVolunteers),
          );

    const rows = await this.db
      .select({
        instanceId: schema.shiftInstances.id,
        shiftId: schema.shifts.id,
        title: shiftInstanceTitle,
        startsAt: schema.shiftInstances.actualStartsAt,
        endsAt: schema.shiftInstances.actualEndsAt,
        minimum: shiftMinimumVolunteers,
        maximum: shiftMaximumVolunteers,
        approvedCount: joinedInviteCount,
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
          gte(schema.shiftInstances.actualStartsAt, now),
          lt(schema.shiftInstances.actualStartsAt, window.end),
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
        schema.shiftInstances.overrideMaxVolunteers,
        schema.shifts.maxVolunteers,
      )
      .having(staffing)
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
        ...(row.minimum == null ? {} : { minimum: Number(row.minimum) }),
        ...(row.maximum == null ? {} : { maximum: Number(row.maximum) }),
      },
    }));
  }

  private async shiftApprovals(organizationUnitId: string): Promise<Task[]> {
    const rows = await this.db
      .select({
        instanceId: schema.shiftInstances.id,
        shiftId: schema.shifts.id,
        title: shiftInstanceTitle,
        startsAt: schema.shiftInstances.actualStartsAt,
        endsAt: schema.shiftInstances.actualEndsAt,
        openRequestCount: shiftOpenApprovalCount,
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
          gte(schema.shiftInstances.actualStartsAt, new Date()),
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
      .having(gt(shiftOpenApprovalCount, 0))
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
    const rows = await this.db
      .select({
        eventId: schema.events.id,
        title: schema.events.title,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        openRequestCount: eventOpenApprovalCount,
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
          gte(schema.events.startsAt, new Date()),
        ),
      )
      .groupBy(
        schema.events.id,
        schema.events.title,
        schema.events.startsAt,
        schema.events.endsAt,
      )
      .having(gt(eventOpenApprovalCount, 0))
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
            email: row.user.email,
            requestedAt: row.createdAt.toISOString(),
          },
        },
      ];
    });
  }

  private async contractRows(
    organizationUnitId: string,
  ): Promise<ContractTaskRow[]> {
    const volunteerContractSignedAt = this.db
      .select({
        contractId: schema.contractSignatures.contractId,
        signedAt: max(schema.contractSignatures.signedAt).as('signed_at'),
      })
      .from(schema.contractSignatures)
      .where(eq(schema.contractSignatures.signeeType, SigneeType.VOLUNTEER))
      .groupBy(schema.contractSignatures.contractId)
      .as('volunteer_contract_signed_at');

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
        declinedAt: schema.contracts.declinedAt,
        volunteerSignedAt: volunteerContractSignedAt.signedAt,
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
      .leftJoin(
        volunteerContractSignedAt,
        eq(volunteerContractSignedAt.contractId, schema.contracts.id),
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

    return rows;
  }

  private async invoiceRows(
    organizationUnitId: string,
  ): Promise<InvoiceTaskRow[]> {
    const volunteerInvoiceSignedAt = this.db
      .select({
        invoiceId: schema.invoiceSignatures.invoiceId,
        signedAt: max(schema.invoiceSignatures.signedAt).as('signed_at'),
      })
      .from(schema.invoiceSignatures)
      .where(eq(schema.invoiceSignatures.signeeType, SigneeType.VOLUNTEER))
      .groupBy(schema.invoiceSignatures.invoiceId)
      .as('volunteer_invoice_signed_at');

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
        declinedAt: schema.invoices.declinedAt,
        volunteerSignedAt: volunteerInvoiceSignedAt.signedAt,
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
      .leftJoin(
        volunteerInvoiceSignedAt,
        eq(volunteerInvoiceSignedAt.invoiceId, schema.invoices.id),
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

    return rows;
  }
}

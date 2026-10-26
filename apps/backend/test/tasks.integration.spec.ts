import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  SigneeType,
} from '../src/accounting/enums';
import { PermissionKey } from '../src/auth/enums';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import { EventInviteStatus } from '../src/event/enums';
import { MembershipRequestStatus } from '../src/membership/enums';
import { ShiftInviteStatus } from '../src/shift/enums';
import { TaskType } from '../src/task/enums/task-type.enum';
import { TaskService } from '../src/task/services/task.service';
import {
  createEvent,
  createMembershipRequest,
  createShift,
  createShiftInstanceInvite,
  createUser,
} from './factories';
import {
  createDocumentTemplate,
  createReimbursementType,
  stubInvoiceDocumentNumber,
} from './factories/accounting.factory';
import { createUnit } from './factories/org.factory';
import {
  assignRoleToMembership,
  createRole,
  grantPermissionToRole,
} from './factories/role.factory';
import { applyBunAuthMocks } from './helpers/auth-mocks';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(30_000);

describe('TaskService.myTasks', () => {
  let app: INestApplication;
  let db: Database;
  let organizationId: string;
  let organizationUnitId: string;
  let service: TaskService;

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    organizationId = context.organizationId;
    organizationUnitId = context.organizationUnitId;
    service = app.get(TaskService);
  });

  async function adminWith(keys: PermissionKey[]) {
    const user = await createUser(db);
    const [membership] = await db
      .insert(schema.memberships)
      .values({ userId: user.id, organizationUnitId })
      .returning();
    const role = await createRole(db, { organizationId });
    for (const key of keys) {
      const [permission] = await db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.key, key))
        .limit(1);
      if (!permission) throw new Error(`Missing seeded permission ${key}`);
      await grantPermissionToRole(db, {
        roleId: role.id,
        permissionId: permission.id,
      });
    }
    if (!membership) throw new Error('Failed to create membership');
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });
    return user;
  }

  it('returns only this unit’s actions the admin can do', async () => {
    const admin = await adminWith([
      PermissionKey.SHIFT_EDIT,
      PermissionKey.VOLUNTEER_EDIT,
      PermissionKey.ACCOUNTING_MANAGE,
    ]);
    const shiftOnly = await adminWith([PermissionKey.SHIFT_EDIT]);
    const volunteer = await createUser(db, {
      firstname: 'Ada',
      lastname: 'Lovelace',
    });
    const [root] = await db
      .select()
      .from(schema.organizationUnits)
      .where(eq(schema.organizationUnits.id, organizationUnitId))
      .limit(1);
    if (!root) throw new Error('Root unit missing');
    const child = await createUnit(db, {
      organizationId,
      typeId: root.typeId,
      name: `Child ${crypto.randomUUID()}`,
      parentId: organizationUnitId,
    });

    const understaffed = await createShift(db, {
      organizationUnitId,
      title: 'Reading hour',
      minVolunteers: 2,
      createdById: admin.id,
    });
    const staffed = await createShift(db, {
      organizationUnitId,
      minVolunteers: 1,
      createdById: admin.id,
    });
    const past = await createShift(db, {
      organizationUnitId,
      title: 'Yesterday',
      minVolunteers: 2,
      createdById: admin.id,
      startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const childShift = await createShift(db, {
      organizationUnitId: child.id,
      minVolunteers: 3,
      createdById: admin.id,
    });
    const approvalShift = await createShift(db, {
      organizationUnitId,
      title: 'Needs a yes',
      createdById: admin.id,
    });

    const instances = async (shiftId: string) => {
      const rows = await db.query.shiftInstances.findMany({
        where: { masterId: shiftId },
      });
      const instance = rows[0];
      if (!instance) throw new Error(`No instance for ${shiftId}`);
      return instance;
    };

    const understaffedInstance = await instances(understaffed.id);
    const staffedInstance = await instances(staffed.id);
    const approvalInstance = await instances(approvalShift.id);
    await createShiftInstanceInvite(db, {
      instanceId: staffedInstance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.JOINED,
    });
    await createShiftInstanceInvite(db, {
      instanceId: approvalInstance.id,
      userId: volunteer.id,
      status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    });
    await createShiftInstanceInvite(db, {
      instanceId: approvalInstance.id,
      userId: admin.id,
      status: ShiftInviteStatus.AWAITING_ADMIN_APPROVAL,
    });

    const event = await createEvent(db, {
      organizationUnitId,
      title: 'Summer fair',
      createdById: admin.id,
    });
    await db.insert(schema.eventInvites).values({
      eventId: event.id,
      userId: volunteer.id,
      status: EventInviteStatus.AWAITING_ADMIN_APPROVAL,
    });

    const volunteerMembershipRequest = await createMembershipRequest(db, {
      userId: volunteer.id,
      organizationUnitId,
    });
    await createMembershipRequest(db, {
      userId: admin.id,
      organizationUnitId: child.id,
    });
    await createMembershipRequest(db, {
      userId: (await createUser(db)).id,
      organizationUnitId,
      status: MembershipRequestStatus.ACCEPTED,
    });

    const reimbursementType = await createReimbursementType(db);
    const contractTemplate = await createDocumentTemplate(db, {
      organizationId,
      reimbursementTypeId: reimbursementType.id,
      kind: DocumentKind.CONTRACT,
      signees: [{ order: 0, signeeType: SigneeType.VOLUNTEER }],
    });
    const invoiceTemplate = await createDocumentTemplate(db, {
      organizationId,
      reimbursementTypeId: reimbursementType.id,
      kind: DocumentKind.INVOICE,
      signees: [{ order: 0, signeeType: SigneeType.VOLUNTEER }],
    });
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = new Date('2026-07-01T00:00:00.000Z');
    const body = { header: {}, blocks: [], footer: {} };
    const [awaitingContract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: contractTemplate.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId,
        contractStatus: ContractStatus.AWAITING_NGO_SIGNATURE,
        periodStart,
        periodEnd,
        resolvedBody: body,
      })
      .returning();
    if (!awaitingContract)
      throw new Error('Failed to create awaiting contract');
    const [orgDeclinedContract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: contractTemplate.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId,
        contractStatus: ContractStatus.DECLINED,
        declinedAtSigneeType: SigneeType.PERMISSION_HOLDER,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-01-01T00:00:00.000Z'),
        resolvedBody: body,
      })
      .returning();
    if (!orgDeclinedContract) {
      throw new Error('Failed to create org-declined contract');
    }

    const invoiceBase = {
      documentTemplateId: invoiceTemplate.id,
      volunteerId: volunteer.id,
      reimbursementTypeId: reimbursementType.id,
      organizationUnitId,
      resolvedBody: body,
      hourlyRateCents: 400,
      totalHours: 3,
      totalAmountCents: 1200,
      ...stubInvoiceDocumentNumber(organizationUnitId),
    };
    const [awaitingInvoice] = await db
      .insert(schema.invoices)
      .values({
        ...invoiceBase,
        invoiceStatus: InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
        periodStart,
        periodEnd,
        ...stubInvoiceDocumentNumber(organizationUnitId),
      })
      .returning();
    if (!awaitingInvoice) throw new Error('Failed to create awaiting invoice');
    await db.insert(schema.invoices).values({
      ...invoiceBase,
      invoiceStatus: InvoiceStatus.READY,
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-01T00:00:00.000Z'),
      ...stubInvoiceDocumentNumber(organizationUnitId),
    });
    await db.insert(schema.invoices).values({
      ...invoiceBase,
      invoiceStatus: InvoiceStatus.READY,
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-01T00:00:00.000Z'),
      ...stubInvoiceDocumentNumber(organizationUnitId),
    });
    await db.insert(schema.invoices).values({
      ...invoiceBase,
      invoiceStatus: InvoiceStatus.READY,
      paidAt: new Date(),
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-01T00:00:00.000Z'),
      ...stubInvoiceDocumentNumber(organizationUnitId),
    });
    const declinedStart = new Date('2026-02-01T00:00:00.000Z');
    const declinedEnd = new Date('2026-03-01T00:00:00.000Z');
    const [volunteerDeclinedInvoice] = await db
      .insert(schema.invoices)
      .values({
        ...invoiceBase,
        invoiceStatus: InvoiceStatus.DECLINED,
        declinedAtSigneeType: SigneeType.VOLUNTEER,
        declineReason: 'Wrong hours',
        periodStart: declinedStart,
        periodEnd: declinedEnd,
        ...stubInvoiceDocumentNumber(organizationUnitId),
      })
      .returning();
    if (!volunteerDeclinedInvoice) {
      throw new Error('Failed to create volunteer-declined invoice');
    }
    await db.insert(schema.invoices).values({
      ...invoiceBase,
      invoiceStatus: InvoiceStatus.DECLINED,
      declinedAtSigneeType: SigneeType.VOLUNTEER,
      periodStart,
      periodEnd,
      ...stubInvoiceDocumentNumber(organizationUnitId),
    });

    const tasks = await service.myTasks(admin.id, organizationUnitId);
    const of = (type: TaskType) => tasks.filter((task) => task.type === type);

    expect(of(TaskType.SHIFT_BELOW_MINIMUM).map((task) => task.id)).toContain(
      understaffedInstance.id,
    );
    expect(
      of(TaskType.SHIFT_BELOW_MINIMUM).map((task) => task.id),
    ).not.toContain(staffedInstance.id);
    const below = of(TaskType.SHIFT_BELOW_MINIMUM).find(
      (task) => task.id === understaffedInstance.id,
    );
    expect(below?.data).toMatchObject({
      title: 'Reading hour',
      approvedCount: 0,
      minimum: 2,
    });
    expect(tasks.some((task) => String(task.data.title) === 'Yesterday')).toBe(
      false,
    );
    expect(tasks.some((task) => task.organizationUnitId === child.id)).toBe(
      false,
    );
    expect(
      of(TaskType.SHIFT_APPROVAL).find(
        (task) => task.id === approvalInstance.id,
      )?.data,
    ).toMatchObject({ title: 'Needs a yes', openRequestCount: 2 });
    expect(
      of(TaskType.EVENT_APPROVAL).find((task) => task.id === event.id)?.data,
    ).toMatchObject({
      title: 'Summer fair',
      openRequestCount: 1,
    });
    expect(
      of(TaskType.MEMBERSHIP_REQUEST).find(
        (task) => task.id === volunteerMembershipRequest.id,
      )?.data,
    ).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: volunteer.email,
    });
    expect(of(TaskType.CONTRACT_SIGN).map((task) => task.id)).toContain(
      awaitingContract.id,
    );
    expect(
      of(TaskType.TIMESHEET_SIGN).find((task) => task.id === awaitingInvoice.id)
        ?.data,
    ).toMatchObject({
      volunteerName: volunteer.name,
      hours: 3,
      amountCents: 1200,
    });
    expect(
      of(TaskType.TIMESHEET_BUNDLES).find(
        (task) => task.id === `bundle:${volunteer.id}:${reimbursementType.key}`,
      )?.data,
    ).toMatchObject({
      readyCount: 2,
      amountCents: 2400,
    });
    expect(
      of(TaskType.DOCUMENT_DECLINED).find(
        (task) => task.id === volunteerDeclinedInvoice.id,
      )?.data,
    ).toMatchObject({
      declineReason: 'Wrong hours',
      declinedAtSigneeType: SigneeType.VOLUNTEER,
    });
    expect(of(TaskType.DOCUMENT_DECLINED).map((task) => task.id)).not.toContain(
      orgDeclinedContract.id,
    );
    expect(tasks.some((task) => task.type === TaskType.CONTRACT_EXPIRING)).toBe(
      false,
    );
    expect(childShift.id).toBeTruthy();
    expect(past.id).toBeTruthy();

    const limited = await service.myTasks(shiftOnly.id, organizationUnitId);
    expect(
      limited.some((task) => task.type === TaskType.MEMBERSHIP_REQUEST),
    ).toBe(false);
    expect(limited.some((task) => task.type === TaskType.CONTRACT_SIGN)).toBe(
      false,
    );
    expect(
      limited.some((task) => task.type === TaskType.SHIFT_BELOW_MINIMUM),
    ).toBe(true);
  });

  it('omits accounting tasks when accountingEnabled is false', async () => {
    const admin = await adminWith([PermissionKey.ACCOUNTING_MANAGE]);
    const volunteer = await createUser(db);
    const reimbursementType = await createReimbursementType(db);
    let contractTemplate = await db.query.documentTemplates.findFirst({
      where: {
        organizationId,
        reimbursementTypeId: reimbursementType.id,
        kind: DocumentKind.CONTRACT,
        isDeleted: false,
      },
    });
    if (!contractTemplate) {
      contractTemplate = await createDocumentTemplate(db, {
        organizationId,
        reimbursementTypeId: reimbursementType.id,
        kind: DocumentKind.CONTRACT,
        signees: [{ order: 0, signeeType: SigneeType.VOLUNTEER }],
      });
    }
    await db
      .update(schema.organizations)
      .set({ accountingEnabled: true })
      .where(eq(schema.organizations.id, organizationId));

    const [draft] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: contractTemplate.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId,
        contractStatus: ContractStatus.DRAFT,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-01-01T00:00:00.000Z'),
        resolvedBody: { header: {}, blocks: [], footer: {} },
      })
      .returning();
    if (!draft) throw new Error('Failed to create draft contract');

    const enabled = await service.myTasks(admin.id, organizationUnitId);
    expect(enabled.some((task) => task.id === draft.id)).toBe(true);

    await db
      .update(schema.organizations)
      .set({ accountingEnabled: false })
      .where(eq(schema.organizations.id, organizationId));

    const disabled = await service.myTasks(admin.id, organizationUnitId);
    const accountingTypes = new Set([
      TaskType.CONTRACT_CREATE,
      TaskType.CONTRACT_SIGN,
      TaskType.INVOICE_CREATE,
      TaskType.TIMESHEET_SIGN,
      TaskType.TIMESHEET_BUNDLES,
      TaskType.DOCUMENT_DECLINED,
    ]);
    expect(disabled.some((task) => accountingTypes.has(task.type))).toBe(false);

    await db
      .update(schema.organizations)
      .set({ accountingEnabled: true })
      .where(eq(schema.organizations.id, organizationId));
  });
});

import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  InvoiceStatus,
  SigneeType,
} from '../src/accounting/enums';
import { ContractService } from '../src/accounting/services/contract.service';
import { DocumentNotificationService } from '../src/accounting/services/document-notification.service';
import { DocumentProfileRequirementService } from '../src/accounting/services/document-profile-requirement.service';
import { DocumentRenderingService } from '../src/accounting/services/document-rendering.service';
import { DocumentSigningService } from '../src/accounting/services/document-signing.service';
import { DocumentTemplateService } from '../src/accounting/services/document-template.service';
import { InvoiceService } from '../src/accounting/services/invoice.service';
import { ReimbursementRateService } from '../src/accounting/services/reimbursement-rate.service';
import { billingMonthBounds } from '../src/accounting/utils/billing-period';
import { AuthService } from '../src/auth/auth.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
} from '../src/graphql/errors';
import { MembershipService } from '../src/membership/membership.service';
import { NotificationService } from '../src/notification';
import { OrganizationMapper } from '../src/organization/mappers/organization.mapper';
import { OrganizationService } from '../src/organization/organization.service';
import { OrganizationUnitService } from '../src/organization/organization-unit.service';
import { OrganizationUnitDataService } from '../src/organization/organization-unit-data.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { FileService } from '../src/storage/services/file.service';
import {
  createCompletedTimeEntry,
  createReimbursementType,
  createTwoStepTemplate,
} from './factories/accounting.factory';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  assignRoleToMembership,
  createPermission,
  createRole,
  grantPermissionToRole,
} from './factories/role.factory';
import { createShift } from './factories/shift.factory';
import { createShiftInstance } from './factories/shift-instance.factory';
import { createUser } from './factories/user.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

describe('InvoiceService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: InvoiceService;
  const declinedByVolunteerCalls: unknown[] = [];

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    const organizationUnitDataService = new OrganizationUnitDataService(db);
    const authService = new AuthService(db, organizationUnitDataService, {
      capture: () => {},
    } as unknown as PostHogService);
    const organizationService = new OrganizationService(
      db,
      {} as OrganizationMapper,
      {} as MembershipService,
      {} as OrganizationUnitService,
      {} as NotificationService,
      {} as FileService,
      { capture: () => {} } as unknown as PostHogService,
    );
    const documentTemplateService = new DocumentTemplateService(
      db,
      {
        capture: () => {},
      } as unknown as PostHogService,
      {
        missingOrgProfileSources: () => Promise.resolve([]),
      } as unknown as DocumentProfileRequirementService,
    );
    const documentSigningService = new DocumentSigningService(
      db,
      authService,
      organizationService,
    );
    const reimbursementRateService = new ReimbursementRateService(
      db,
      organizationUnitDataService,
      {} as MembershipService,
      { capture: () => {} } as unknown as PostHogService,
    );
    const contractService = new ContractService(
      db,
      documentTemplateService,
      documentSigningService,
      {
        notifyAwaitingVolunteerSignature: () => Promise.resolve(),
        notifyDeclinedByOrg: () => Promise.resolve(),
        notifyDeclinedByVolunteer: () => Promise.resolve(),
      } as unknown as DocumentNotificationService,
      {
        missingProfileSources: () => Promise.resolve([]),
        missingOrgProfileSources: () => Promise.resolve([]),
      } as unknown as DocumentProfileRequirementService,
      {
        renderAndAttachPdf: () => Promise.resolve(null),
      } as unknown as DocumentRenderingService,
      { capture: () => {} } as unknown as PostHogService,
    );
    service = new InvoiceService(
      db,
      documentTemplateService,
      documentSigningService,
      reimbursementRateService,
      contractService,
      {
        notifyAwaitingVolunteerSignature: () => Promise.resolve(),
        notifyDeclinedByOrg: () => Promise.resolve(),
        notifyDeclinedByVolunteer: (input: unknown) => {
          declinedByVolunteerCalls.push(input);
          return Promise.resolve();
        },
      } as unknown as DocumentNotificationService,
      {
        missingProfileSources: () => Promise.resolve([]),
        missingOrgProfileSources: () => Promise.resolve([]),
      } as unknown as DocumentProfileRequirementService,
      {
        renderAndAttachPdf: () => Promise.resolve(null),
      } as unknown as DocumentRenderingService,
      { capture: () => {} } as unknown as PostHogService,
    );

    registerTestResourceCleanup(async () => {
      await moduleRef.close();
    });
  });

  /** Org + root unit + an invoice template (volunteer -> permission holder) + a completed, unclaimed time entry. */
  const setup = async (args?: { rateCents?: number }) => {
    const reimbursementType = await createReimbursementType(db, {
      platformDefaultRateCents: args?.rateCents ?? 1_500,
    });
    const { organization, type } = await createOrganizationWithType(
      db,
      `Invoice Org ${crypto.randomUUID()}`,
    );
    const root = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });
    const permission = await createPermission(db, {
      key: `accounting:manage:${crypto.randomUUID()}`,
    });
    const role = await createRole(db, { organizationId: organization.id });
    await grantPermissionToRole(db, {
      roleId: role.id,
      permissionId: permission.id,
    });
    const supervisor = await createUser(db);
    const supervisorMembership = await addMembership(
      db,
      supervisor.id,
      root.id,
    );
    await assignRoleToMembership(db, {
      membershipId: supervisorMembership.id,
      roleId: role.id,
    });
    await createTwoStepTemplate(db, {
      organizationId: organization.id,
      reimbursementTypeId: reimbursementType.id,
      kind: DocumentKind.INVOICE,
      requiredPermissionId: permission.id,
      signeeTypes: [SigneeType.VOLUNTEER, SigneeType.PERMISSION_HOLDER],
    });
    const contractTemplate = await createTwoStepTemplate(db, {
      organizationId: organization.id,
      reimbursementTypeId: reimbursementType.id,
      kind: DocumentKind.CONTRACT,
      requiredPermissionId: permission.id,
      signeeTypes: [SigneeType.VOLUNTEER, SigneeType.PERMISSION_HOLDER],
    });
    const volunteer = await createUser(db);
    const timeEntry = await createCompletedTimeEntry(db, {
      organizationUnitId: root.id,
      volunteerId: volunteer.id,
      reimbursementTypeId: reimbursementType.id,
      startedAt: new Date('2026-07-01T09:00:00.000Z'),
      endedAt: new Date('2026-07-01T13:00:00.000Z'), // 4 hours
    });

    return {
      organization,
      root,
      reimbursementType,
      volunteer,
      supervisor,
      timeEntry,
      contractTemplate,
    };
  };

  describe('findInvoicesForOrganization — period filter', () => {
    it('excludes invoices whose period does not overlap the requested range', async () => {
      const { organization, root, reimbursementType, volunteer, supervisor } =
        await setup();
      const marchTimeEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-03-02T09:00:00.000Z'),
        endedAt: new Date('2026-03-02T13:00:00.000Z'),
      });
      const outOfRangeTimeEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-06-01T09:00:00.000Z'),
        endedAt: new Date('2026-06-01T13:00:00.000Z'),
      });

      const inRange = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [marchTimeEntry.id],
          periodStart: new Date('2026-03-01'),
          periodEnd: new Date('2026-03-31'),
        },
        supervisor.id,
      );
      const outOfRange = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [outOfRangeTimeEntry.id],
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2026-06-30'),
        },
        supervisor.id,
      );

      const results = await service.findInvoicesForOrganization(
        organization.id,
        {
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-04-01'),
        },
      );

      const ids = results.map((r) => r.id);
      expect(ids).toContain(inRange.id);
      expect(ids).not.toContain(outOfRange.id);
    });

    it('scopes invoices to the requested organization unit', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: root.typeId,
        name: 'sibling',
        parentId: root.id,
      });
      const siblingEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: sibling.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });

      const inRoot = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01'),
          periodEnd: new Date('2026-07-31'),
        },
        supervisor.id,
      );
      const inSibling = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: sibling.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [siblingEntry.id],
          periodStart: new Date('2026-07-01'),
          periodEnd: new Date('2026-07-31'),
        },
        supervisor.id,
      );

      const rootOnly = await service.findInvoicesForOrganization(
        organization.id,
        { organizationUnitId: root.id },
      );
      const ids = rootOnly.map((i) => i.id);
      expect(ids).toContain(inRoot.id);
      expect(ids).not.toContain(inSibling.id);
    });

    it('excludes DRAFT invoices when issuedOnly is set', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      const issued = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01'),
          periodEnd: new Date('2026-07-31'),
        },
        supervisor.id,
      );

      // No public API creates a draft invoice; insert one directly to prove the
      // defensive filter, mirroring a legacy/other writer.
      const template = await db.query.documentTemplates.findFirst({
        where: { organizationId: organization.id, kind: DocumentKind.INVOICE },
      });
      if (!template) throw new Error('missing invoice template');
      const [draft] = await db
        .insert(schema.invoices)
        .values({
          documentTemplateId: template.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          invoiceStatus: InvoiceStatus.DRAFT,
          periodStart: new Date('2026-08-01'),
          periodEnd: new Date('2026-08-31'),
          totalAmountCents: 0,
          totalHours: 0,
          resolvedBody: { header: {}, blocks: [], footer: {} },
        })
        .returning();
      if (!draft) throw new Error('failed to insert draft invoice');

      const all = await service.findInvoicesForOrganization(organization.id);
      expect(all.map((i) => i.id).sort()).toEqual([issued.id, draft.id].sort());

      const onlyIssued = await service.findInvoicesForOrganization(
        organization.id,
        { issuedOnly: true },
      );
      expect(onlyIssued.map((i) => i.id)).toEqual([issued.id]);
    });
  });

  describe('findEligibleTimeEntries', () => {
    it("includes hours from the last day's evening in a Berlin month period", async () => {
      const { root, reimbursementType, volunteer } = await setup();
      // 31 July, 23:30 to 23:50 in Berlin (CEST): still July there.
      const lastEvening = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-31T21:30:00.000Z'),
        endedAt: new Date('2026-07-31T21:50:00.000Z'),
      });
      // 1 August, 00:30 in Berlin: belongs to August even though it is
      // still 31 July in UTC.
      const nextMonth = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-31T22:30:00.000Z'),
        endedAt: new Date('2026-07-31T23:00:00.000Z'),
      });

      const july = billingMonthBounds(new Date('2026-07-15T12:00:00.000Z'));
      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        july.start,
        july.end,
      );

      const ids = eligible.map((entry) => entry.id);
      expect(ids).toContain(lastEvening.id);
      expect(ids).not.toContain(nextMonth.id);
    });

    it('excludes entries that have not been ended yet', async () => {
      const { root, reimbursementType, volunteer } = await setup();
      const shift = await createShift(db, {
        organizationUnitId: root.id,
        createdById: volunteer.id,
      });
      const instance = await createShiftInstance(db, shift.id);
      await db.insert(schema.timeEntries).values({
        shiftInstanceId: instance.id,
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date(),
        endedAt: null,
      });

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
      );
      expect(eligible.every((entry) => entry.endedAt !== null)).toBe(true);
    });

    it('excludes an entry claimed by a live (non-declined) invoice', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
      );
      expect(eligible.map((e) => e.id)).not.toContain(timeEntry.id);
    });

    it('releases an entry back to the eligible pool once its invoice is declined', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.declineInvoice(invoice.id, volunteer.id, 'changed my mind');

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
      );
      expect(eligible.map((e) => e.id)).toContain(timeEntry.id);
    });

    it('lets a replacement invoice be created for the hours of a declined one', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      const declinedInvoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.declineInvoice(
        declinedInvoice.id,
        volunteer.id,
        'changed my mind',
      );

      const replacement = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(replacement.id).not.toBe(declinedInvoice.id);

      // Retained as a record, not deleted.
      const stillThere = await service.findInvoice(declinedInvoice.id);
      expect(stillThere.invoiceStatus).toBe(InvoiceStatus.DECLINED);

      // No longer selectable now that a live invoice holds it again.
      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
      );
      expect(eligible.map((e) => e.id)).not.toContain(timeEntry.id);
    });
  });

  describe('findVolunteersNeedingTimesheets', () => {
    const yearPeriod = () =>
      [
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z'),
      ] as const;

    it('returns volunteers with an eligible (unclaimed, completed, in-period) time entry and its hours', async () => {
      const { root, reimbursementType, volunteer, timeEntry } = await setup();
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        // July 2026 as a Berlin calendar month.
        periodStart: new Date('2026-06-30T22:00:00.000Z'),
        periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        eligibleHours: 4,
      });
      expect(result[0]?.volunteerId).toBe(timeEntry.volunteerId);
    });

    it('adds up every unclaimed entry per Berlin month into one row', async () => {
      const { root, reimbursementType, volunteer } = await setup();
      const entry = (startedAt: string, endedAt: string) =>
        createCompletedTimeEntry(db, {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
        });
      await entry('2026-07-20T09:00:00.000Z', '2026-07-20T11:00:00.000Z');
      // 31 July 23:30 in Berlin is still July.
      await entry('2026-07-31T21:30:00.000Z', '2026-07-31T22:00:00.000Z');
      await entry('2026-08-03T09:00:00.000Z', '2026-08-03T10:00:00.000Z');
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      const rows = result
        .filter((row) => row.volunteerId === volunteer.id)
        .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
      expect(rows).toEqual([
        {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
          eligibleHours: 6.5,
        },
        {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
          eligibleHours: 1,
        },
      ]);
    });

    it('excludes a volunteer whose only entry has already been claimed by an invoice', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      expect(result.map((r) => r.volunteerId)).not.toContain(volunteer.id);
    });

    it('surfaces the hours again once the invoice is declined', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.declineInvoice(invoice.id, volunteer.id, 'wrong hours');

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2027-01-01T00:00:00.000Z'),
      );

      const row = result.find((r) => r.volunteerId === volunteer.id);
      expect(row).toEqual({
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        periodStart: new Date('2026-06-30T22:00:00.000Z'),
        periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        eligibleHours: 4,
      });
    });

    it('excludes a volunteer whose only time entry has not been ended yet', async () => {
      const { root, reimbursementType } = await setup();
      const volunteer = await createUser(db);
      const shift = await createShift(db, {
        organizationUnitId: root.id,
        createdById: volunteer.id,
      });
      const instance = await createShiftInstance(db, shift.id);
      await db.insert(schema.timeEntries).values({
        shiftInstanceId: instance.id,
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-01T09:00:00.000Z'),
        endedAt: null,
      });
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      expect(result.map((r) => r.volunteerId)).not.toContain(volunteer.id);
    });

    it('excludes entries that fall outside the requested period', async () => {
      const { root } = await setup();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z'),
      );

      expect(result).toEqual([]);
    });

    it('scopes the result to the requested organization unit', async () => {
      const { root } = await setup();
      const reimbursementType = await createReimbursementType(db);
      const { organization, type } = await createOrganizationWithType(
        db,
        `Other Org ${crypto.randomUUID()}`,
      );
      const otherRoot = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        name: 'other-root',
      });
      const otherVolunteer = await createUser(db);
      await createCompletedTimeEntry(db, {
        organizationUnitId: otherRoot.id,
        volunteerId: otherVolunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-01T09:00:00.000Z'),
        endedAt: new Date('2026-07-01T13:00:00.000Z'),
      });
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      expect(result.map((r) => r.volunteerId)).not.toContain(otherVolunteer.id);
    });
  });

  describe('createInvoice', () => {
    it('rejects an empty selection of time entries', async () => {
      const { organization, reimbursementType, volunteer, supervisor } =
        await setup();

      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: null,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [],
            periodStart: new Date(),
            periodEnd: new Date(),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestGraphQLError);
    });

    it('rejects a time entry id that is not eligible', async () => {
      const { organization, reimbursementType, volunteer, supervisor } =
        await setup();

      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: null,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [crypto.randomUUID()],
            periodStart: new Date(),
            periodEnd: new Date(),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
    });

    it('computes total hours and amount from the effective rate', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup({ rateCents: 1_500 });

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.totalHours).toBe(4);
      expect(invoice.totalAmountCents).toBe(4 * 1_500);
    });

    it('uses the org rate override over the platform default', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup({ rateCents: 1_500 });
      const reimbursementRateService = new ReimbursementRateService(
        db,
        new OrganizationUnitDataService(db),
        {} as MembershipService,
        { capture: () => {} } as unknown as PostHogService,
      );
      await reimbursementRateService.setReimbursementRate(
        organization.id,
        reimbursementType.id,
        2_000,
        supervisor.id,
      );

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.totalAmountCents).toBe(4 * 2_000);
    });

    it('flags the invoice as non-compliant when the volunteer has no active contract', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.isNonCompliant).toBe(true);
    });

    it('does not flag the invoice when the volunteer has an active contract', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
        contractTemplate,
      } = await setup();
      await db.insert(schema.contracts).values({
        documentTemplateId: contractTemplate.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        contractStatus: ContractStatus.ACTIVE,
        periodStart: new Date(Date.now() - 86_400_000),
        periodEnd: new Date(Date.now() + 86_400_000),
        resolvedBody: { header: {}, blocks: [], footer: {} },
      });

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.isNonCompliant).toBe(false);
    });

    it('auto-creates a DRAFT contract when the volunteer has no contract', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const contracts = await db.query.contracts.findMany({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
        },
      });
      expect(contracts).toHaveLength(1);
      expect(contracts[0].contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('puts every selected entry of the month on one invoice', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup({ rateCents: 1_500 });
      const more = await Promise.all(
        ['2026-07-10', '2026-07-24'].map((day) =>
          createCompletedTimeEntry(db, {
            organizationUnitId: root.id,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            startedAt: new Date(`${day}T09:00:00.000Z`),
            endedAt: new Date(`${day}T11:00:00.000Z`),
          }),
        ),
      );

      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id, ...more.map((entry) => entry.id)],
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.totalHours).toBe(8);
      expect(invoice.totalAmountCents).toBe(8 * 1_500);
      const full = await service.findInvoice(invoice.id);
      expect(full.invoiceTimeEntries).toHaveLength(3);
      const invoices = await db.query.invoices.findMany({
        where: { volunteerId: volunteer.id },
      });
      expect(invoices).toHaveLength(1);
    });

    it('rejects an entry outside the invoice period', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      // The entry is in July; the invoice is for August.
      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: root.id,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [timeEntry.id],
            periodStart: new Date('2026-07-31T22:00:00.000Z'),
            periodEnd: new Date('2026-08-31T22:00:00.000Z'),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
    });

    it('rejects a second timesheet for the same volunteer, type and month', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const otherEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
        endedAt: new Date('2026-07-05T11:00:00.000Z'),
      });
      const period = {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        periodStart: new Date('2026-06-30T22:00:00.000Z'),
        periodEnd: new Date('2026-07-31T22:00:00.000Z'),
      };

      await service.createInvoice(
        organization.id,
        { ...period, timeEntryIds: [timeEntry.id] },
        supervisor.id,
      );

      // A second timesheet for the same month would split the month across
      // documents; the board models one row per month, so it is rejected.
      await expect(
        service.createInvoice(
          organization.id,
          { ...period, timeEntryIds: [otherEntry.id] },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);

      const invoices = await db.query.invoices.findMany({
        where: { volunteerId: volunteer.id },
      });
      expect(invoices).toHaveLength(1);
    });

    it('allows a timesheet for the same volunteer and type in another month', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const augustEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-08-05T09:00:00.000Z'),
        endedAt: new Date('2026-08-05T11:00:00.000Z'),
      });

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [augustEntry.id],
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
        supervisor.id,
      );

      const invoices = await db.query.invoices.findMany({
        where: { volunteerId: volunteer.id },
      });
      expect(invoices).toHaveLength(2);
    });

    it('does not create a second draft contract for the same volunteer, type and year', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const secondEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: timeEntry.organizationUnitId,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        // A different month, so the two timesheets do not overlap.
        startedAt: new Date('2026-08-02T09:00:00.000Z'),
        endedAt: new Date('2026-08-02T13:00:00.000Z'),
      });

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [secondEntry.id],
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
        supervisor.id,
      );

      const contracts = await db.query.contracts.findMany({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
        },
      });
      expect(contracts).toHaveLength(1);
      expect(contracts[0].contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('drafts for the following year despite a prior-year contract ending Jan 1', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        contractTemplate,
      } = await setup();
      const timeEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2027-07-01T09:00:00.000Z'),
        endedAt: new Date('2027-07-01T13:00:00.000Z'),
      });
      await db.insert(schema.contracts).values({
        documentTemplateId: contractTemplate.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        contractStatus: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        // The 2026 Berlin calendar year; its exclusive end is 1 Jan 2027 00:00 Berlin.
        periodStart: new Date('2025-12-31T23:00:00.000Z'),
        periodEnd: new Date('2026-12-31T23:00:00.000Z'),
        resolvedBody: { header: {}, blocks: [], footer: {} },
      });

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2027-07-01T00:00:00.000Z'),
          periodEnd: new Date('2027-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const contracts = await db.query.contracts.findMany({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
        },
      });
      expect(contracts).toHaveLength(2);
      const drafts = contracts.filter(
        (c) => c.contractStatus === ContractStatus.DRAFT,
      );
      expect(drafts).toHaveLength(1);
    });

    it('claims the time entry so it cannot be pulled into a second invoice', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

      await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: null,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [timeEntry.id],
            periodStart: new Date('2026-07-01T00:00:00.000Z'),
            periodEnd: new Date('2026-07-31T00:00:00.000Z'),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
    });
  });

  describe('signInvoice', () => {
    it('marks claimed time entries as paid once the invoice reaches READY', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const afterVolunteer = await service.signInvoice(
        invoice.id,
        volunteer.id,
      );
      expect(afterVolunteer.invoiceStatus).toBe(
        InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
      );

      const beforeReady = await db.query.timeEntries.findFirst({
        where: { id: timeEntry.id },
      });
      expect(beforeReady?.isPaid).toBe(false);

      const afterSupervisor = await service.signInvoice(
        invoice.id,
        supervisor.id,
      );
      expect(afterSupervisor.invoiceStatus).toBe(InvoiceStatus.READY);

      const afterReady = await db.query.timeEntries.findFirst({
        where: { id: timeEntry.id },
      });
      expect(afterReady?.isPaid).toBe(true);

      const statusChanges = await service.findInvoiceStatusChanges(invoice.id);
      expect(statusChanges.map((e) => e.type)).toEqual([
        DocumentStatusChange.CREATED,
        DocumentStatusChange.SIGNED,
        DocumentStatusChange.COUNTERSIGNED,
        DocumentStatusChange.ACTIVATED,
      ]);
    });
  });

  describe('declineInvoice', () => {
    it('records the decline reason and leaves the time entry claimed', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const declined = await service.declineInvoice(
        invoice.id,
        volunteer.id,
        'Wrong hours',
      );

      expect(declined.invoiceStatus).toBe(InvoiceStatus.DECLINED);
      expect(declined.declineReason).toBe('Wrong hours');
      expect(declined.declinedAtSigneeType).toBe(SigneeType.VOLUNTEER);
    });

    it('notifies the admin side when the volunteer declines (VOLI-1246)', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const before = declinedByVolunteerCalls.length;
      await service.declineInvoice(invoice.id, volunteer.id, 'Wrong hours');

      expect(declinedByVolunteerCalls.length).toBe(before + 1);
      expect(declinedByVolunteerCalls.at(-1)).toMatchObject({
        organizationId: organization.id,
        volunteerUserId: volunteer.id,
        documentId: invoice.id,
        documentKind: DocumentKind.INVOICE,
        reason: 'Wrong hours',
      });
    });
  });

  describe('findPendingInvoiceSignee', () => {
    it('returns the volunteer as the pending signee right after creation', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      const pending = await service.findPendingInvoiceSignee(invoice.id);
      expect(pending).toEqual({
        signeeType: SigneeType.VOLUNTEER,
        userId: volunteer.id,
      });
    });

    it('returns null once the invoice is fully signed', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const invoice = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );
      await service.signInvoice(invoice.id, volunteer.id);
      await service.signInvoice(invoice.id, supervisor.id);

      const pending = await service.findPendingInvoiceSignee(invoice.id);
      expect(pending).toBeNull();
    });
  });
});

import { beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  InvoiceStatus,
  ReimbursementTypeKey,
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
import { billingMonthBoundsOf } from '../src/accounting/utils/billing-period';
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
import { TimeEntryClosureKind } from '../src/time-tracking/enums/time-entry-closure-kind.enum';
import {
  createCompletedTimeEntry,
  createDocumentFile,
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
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('InvoiceService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: InvoiceService;
  let contractService: ContractService;
  closeTestingModuleAfterAll(() => moduleRef);
  /** Each resolution is numbered, so a test sees which one was stored. */
  let renderInputsResolved = 0;
  const resolveRenderInputs = () =>
    Promise.resolve({
      values: { resolution: String(++renderInputsResolved) },
    });
  const declinedByVolunteerCalls: unknown[] = [];
  const renderCalls: { invoiceId: string; actorUserId: string }[] = [];
  let renderedFileId: string | null = null;

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
    const documentSigningService = new DocumentSigningService(db, authService);
    const reimbursementRateService = new ReimbursementRateService(
      db,
      organizationUnitDataService,
      {} as MembershipService,
      { capture: () => {} } as unknown as PostHogService,
    );
    contractService = new ContractService(
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
        resolveRenderInputs: () => resolveRenderInputs(),
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
        resolveRenderInputs: () => resolveRenderInputs(),
        renderAndAttachPdf: (document: { id: string }, actorUserId: string) => {
          renderCalls.push({ invoiceId: document.id, actorUserId });
          return Promise.resolve(renderedFileId);
        },
      } as unknown as DocumentRenderingService,
      organizationService,
      { capture: () => {} } as unknown as PostHogService,
    );
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
      type,
      reimbursementType,
      volunteer,
      supervisor,
      timeEntry,
      contractTemplate,
    };
  };

  /** A completed entry the auto-close job ended, so its hours await review. */
  const createAutoClosedTimeEntry = async (
    args: Parameters<typeof createCompletedTimeEntry>[1],
  ) => {
    const entry = await createCompletedTimeEntry(db, args);
    await db
      .update(schema.timeEntries)
      .set({ closureKind: TimeEntryClosureKind.AUTO })
      .where(eq(schema.timeEntries.id, entry.id));
    return entry;
  };

  type Fixture = Awaited<ReturnType<typeof setup>>;

  /** Berlin day bounds as ISO instants, so a spec reads as calendar dates. */
  const JULY_FIRST_HALF = {
    start: '2026-06-30T22:00:00.000Z', // 1 Jul 00:00 Berlin
    end: '2026-07-15T22:00:00.000Z', // 16 Jul 00:00 Berlin, exclusive
  };
  const JULY_SECOND_HALF = {
    start: '2026-07-15T22:00:00.000Z',
    end: '2026-07-31T22:00:00.000Z', // 1 Aug 00:00 Berlin, exclusive
  };
  const JULY_TIMESHEET = {
    start: '2026-06-30T22:00:00.000Z',
    end: '2026-07-31T22:00:00.000Z',
  };

  const insertContract = (
    s: Fixture,
    period: { start: string; end: string },
    options: { status?: ContractStatus; unitId?: string | null } = {},
  ) =>
    db.insert(schema.contracts).values({
      documentTemplateId: s.contractTemplate.id,
      volunteerId: s.volunteer.id,
      reimbursementTypeId: s.reimbursementType.id,
      organizationUnitId:
        options.unitId === undefined ? s.root.id : options.unitId,
      contractStatus: options.status ?? ContractStatus.ACTIVE,
      periodStart: new Date(period.start),
      periodEnd: new Date(period.end),
      resolvedBody: { header: {}, blocks: [], footer: {} },
    });

  const entryAt = (s: Fixture, startedAt: string) =>
    createCompletedTimeEntry(db, {
      organizationUnitId: s.root.id,
      volunteerId: s.volunteer.id,
      reimbursementTypeId: s.reimbursementType.id,
      startedAt: new Date(startedAt),
      endedAt: new Date(new Date(startedAt).getTime() + 2 * 3_600_000),
    });

  const issueTimesheet = (
    s: Fixture,
    timeEntryIds: string[],
    period: { start: string; end: string },
    unitId: string | null = null,
  ) =>
    service.createInvoice(
      s.organization.id,
      {
        organizationUnitId: unitId,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        timeEntryIds,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
      },
      s.supervisor.id,
    );

  const draftsOf = (s: Fixture) =>
    db.query.contracts.findMany({
      where: {
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        contractStatus: ContractStatus.DRAFT,
      },
    });

  /** Sets the Vertragslaufzeit the fixture's contract template carries. */
  const setLifespan = (s: Fixture, lifespan: string) =>
    db
      .update(schema.documentTemplates)
      .set({
        body: {
          header: {
            metaLines: [
              {
                id: 'meta',
                text: 'Laufzeit {lifespan}',
                fields: [
                  {
                    id: 'contract-lifespan',
                    value: { kind: 'manual-template', value: lifespan },
                  },
                ],
              },
            ],
          },
          blocks: [],
          footer: {},
        },
      })
      .where(eq(schema.documentTemplates.id, s.contractTemplate.id));

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

      const july = billingMonthBoundsOf(new Date('2026-07-15T12:00:00.000Z'));
      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        root.id,
        july.start,
        july.end,
      );

      const ids = eligible.map((entry) => entry.id);
      expect(ids).toContain(lastEvening.id);
      expect(ids).not.toContain(nextMonth.id);
    });

    it('excludes entries that belong to a sibling organization unit', async () => {
      const { organization, root, type, reimbursementType, volunteer } =
        await setup();
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        parentId: root.id,
        name: `Sibling ${crypto.randomUUID()}`,
      });
      // setup() already placed a completed entry on root; add one on the
      // sibling for the same volunteer / type / period.
      const siblingEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: sibling.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });

      const eligibleForRoot = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        root.id,
      );
      const eligibleForSibling = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        sibling.id,
      );

      expect(eligibleForRoot.map((e) => e.id)).not.toContain(siblingEntry.id);
      expect(eligibleForSibling.map((e) => e.id)).toEqual([siblingEntry.id]);
    });

    it("rejects creating an invoice that claims a sibling unit's hours", async () => {
      const {
        organization,
        root,
        type,
        reimbursementType,
        volunteer,
        supervisor,
      } = await setup();
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        parentId: root.id,
        name: `Sibling ${crypto.randomUUID()}`,
      });
      const siblingEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: sibling.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });

      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: root.id,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [siblingEntry.id],
            periodStart: new Date('2026-07-01T00:00:00.000Z'),
            periodEnd: new Date('2026-07-31T00:00:00.000Z'),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
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
        root.id,
      );
      expect(eligible.every((entry) => entry.endedAt !== null)).toBe(true);
    });

    it('excludes an entry claimed by a live (non-declined) invoice', async () => {
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

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        root.id,
      );
      expect(eligible.map((e) => e.id)).not.toContain(timeEntry.id);
    });

    it('releases an entry back to the eligible pool once its invoice is declined', async () => {
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
        invoice.id,
        volunteer.id,
        'changed my mind',
        root.id,
      );

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        root.id,
      );
      expect(eligible.map((e) => e.id)).toContain(timeEntry.id);
    });

    it('lets a replacement invoice be created for the hours of a declined one', async () => {
      const {
        organization,
        root,
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
        root.id,
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
        root.id,
      );
      expect(eligible.map((e) => e.id)).not.toContain(timeEntry.id);
    });
    it('excludes AUTO_CLOSED entries until they are reviewed', async () => {
      const { root, reimbursementType, volunteer, timeEntry } = await setup();
      const autoClosed = await createAutoClosedTimeEntry({
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });

      const eligible = await service.findEligibleTimeEntries(
        volunteer.id,
        reimbursementType.id,
        root.id,
      );

      const ids = eligible.map((entry) => entry.id);
      expect(ids).toContain(timeEntry.id);
      expect(ids).not.toContain(autoClosed.id);
    });
  });

  describe('findTimeEntriesAwaitingReview', () => {
    it('returns only AUTO_CLOSED, unclaimed entries of the unit and type, in the period', async () => {
      const {
        organization,
        root,
        type,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const base = {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
      };
      const awaiting = await createAutoClosedTimeEntry({
        ...base,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });
      const outOfPeriod = await createAutoClosedTimeEntry({
        ...base,
        startedAt: new Date('2026-08-02T09:00:00.000Z'),
        endedAt: new Date('2026-08-02T13:00:00.000Z'),
      });
      const otherType = await createReimbursementType(db, {
        key: ReimbursementTypeKey.UEBUNGSLEITER,
      });
      const wrongType = await createAutoClosedTimeEntry({
        ...base,
        reimbursementTypeId: otherType.id,
        startedAt: new Date('2026-07-03T09:00:00.000Z'),
        endedAt: new Date('2026-07-03T13:00:00.000Z'),
      });
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        parentId: root.id,
        name: `Sibling ${crypto.randomUUID()}`,
      });
      const wrongUnit = await createAutoClosedTimeEntry({
        ...base,
        organizationUnitId: sibling.id,
        startedAt: new Date('2026-07-04T09:00:00.000Z'),
        endedAt: new Date('2026-07-04T13:00:00.000Z'),
      });
      const otherVolunteer = await createAutoClosedTimeEntry({
        ...base,
        volunteerId: (await createUser(db)).id,
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
        endedAt: new Date('2026-07-05T13:00:00.000Z'),
      });
      // Claimed by a live timesheet: no longer up for review here.
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
      await db
        .update(schema.timeEntries)
        .set({ closureKind: TimeEntryClosureKind.AUTO })
        .where(eq(schema.timeEntries.id, timeEntry.id));

      const july = billingMonthBoundsOf(new Date('2026-07-15T12:00:00.000Z'));
      const result = await service.findTimeEntriesAwaitingReview(
        volunteer.id,
        reimbursementType.id,
        root.id,
        july.start,
        july.end,
      );

      const ids = result.map((entry) => entry.id);
      expect(ids).toContain(awaiting.id);
      expect(ids).not.toContain(outOfPeriod.id);
      expect(ids).not.toContain(wrongType.id);
      expect(ids).not.toContain(wrongUnit.id);
      expect(ids).not.toContain(otherVolunteer.id);
      expect(ids).not.toContain(timeEntry.id);
      expect(ids).toEqual([awaiting.id]);
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
        // No contract of any kind covers the entry.
        hasUncoveredHours: true,
        firstUncoveredAt: new Date('2026-07-01T09:00:00.000Z'),
        hasHoursWithoutActiveContract: true,
      });
      expect(result[0]?.volunteerId).toBe(timeEntry.volunteerId);
    });

    it('ignores AUTO_CLOSED hours until they are reviewed', async () => {
      const { root, reimbursementType, volunteer } = await setup();
      await createAutoClosedTimeEntry({
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T11:00:00.000Z'),
      });
      const [periodStart, periodEnd] = yearPeriod();

      const result = await service.findVolunteersNeedingTimesheets(
        root.id,
        periodStart,
        periodEnd,
      );

      // Only the 4 regular hours from setup(); the 2 auto-closed ones wait.
      expect(result).toHaveLength(1);
      expect(result[0]?.eligibleHours).toBe(4);
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
          hasUncoveredHours: true,
          firstUncoveredAt: new Date('2026-07-01T09:00:00.000Z'),
          hasHoursWithoutActiveContract: true,
        },
        {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
          eligibleHours: 1,
          hasUncoveredHours: true,
          firstUncoveredAt: new Date('2026-08-03T09:00:00.000Z'),
          hasHoursWithoutActiveContract: true,
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
      await service.declineInvoice(
        invoice.id,
        volunteer.id,
        'wrong hours',
        root.id,
      );

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
        // Issuing the declined timesheet queued a draft contract over these
        // hours, and a draft is cover for the reminder: it is its own task.
        hasUncoveredHours: false,
        firstUncoveredAt: null,
        hasHoursWithoutActiveContract: true,
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

    describe('uncovered hours (VOLI-1587)', () => {
      const rowFor = async (s: Fixture, month: 'JUL' | 'AUG' = 'JUL') => {
        const rows = await service.findVolunteersNeedingTimesheets(
          s.root.id,
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2027-01-01T00:00:00.000Z'),
        );
        const start =
          month === 'JUL'
            ? '2026-06-30T22:00:00.000Z'
            : '2026-07-31T22:00:00.000Z';
        return rows.find(
          (row) =>
            row.volunteerId === s.volunteer.id &&
            row.periodStart.toISOString() === start,
        );
      };

      it('is false when every entry of the month is inside an active contract', async () => {
        const s = await setup();
        await entryAt(s, '2026-07-20T09:00:00.000Z');
        await insertContract(s, JULY_TIMESHEET);

        const row = await rowFor(s);

        expect(row?.hasUncoveredHours).toBe(false);
        expect(row?.firstUncoveredAt).toBeNull();
      });

      it('is true with the earliest uncovered start when one entry is outside every contract', async () => {
        const s = await setup(); // entry at 2026-07-01T09:00Z
        // The earliest uncovered entry (16 Jul) sits in the middle of the
        // insertion order, so neither "first row wins" nor "last row wins"
        // returns it by accident.
        await entryAt(s, '2026-07-25T09:00:00.000Z');
        await entryAt(s, '2026-07-16T09:00:00.000Z');
        await entryAt(s, '2026-07-20T09:00:00.000Z');
        // Covers 1 Jul (the setup entry) only.
        await insertContract(s, {
          start: '2026-06-30T22:00:00.000Z',
          end: '2026-07-10T22:00:00.000Z',
        });

        const row = await rowFor(s);

        expect(row?.hasUncoveredHours).toBe(true);
        expect(row?.firstUncoveredAt).toEqual(
          new Date('2026-07-16T09:00:00.000Z'),
        );
      });

      it('is only satisfied by an ACTIVE contract for the hasHoursWithoutActiveContract flag', async () => {
        const awaiting = await setup();
        await insertContract(awaiting, JULY_TIMESHEET, {
          status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        });
        const active = await setup();
        await insertContract(active, JULY_TIMESHEET);

        const awaitingRow = await rowFor(awaiting);
        const activeRow = await rowFor(active);

        // Open cover (no reminder) but not an ACTIVE contract (still no agreement).
        expect(awaitingRow?.hasUncoveredHours).toBe(false);
        expect(awaitingRow?.hasHoursWithoutActiveContract).toBe(true);
        expect(activeRow?.hasUncoveredHours).toBe(false);
        expect(activeRow?.hasHoursWithoutActiveContract).toBe(false);
      });

      it('is false when only a draft or a contract awaiting signature covers the hours', async () => {
        const draft = await setup();
        await insertContract(draft, JULY_TIMESHEET, {
          status: ContractStatus.DRAFT,
        });
        const awaiting = await setup();
        await insertContract(awaiting, JULY_TIMESHEET, {
          status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        });

        expect((await rowFor(draft))?.hasUncoveredHours).toBe(false);
        expect((await rowFor(awaiting))?.hasUncoveredHours).toBe(false);
      });

      it('is true when only a declined contract is over the hours', async () => {
        const s = await setup();
        await insertContract(s, JULY_TIMESHEET, {
          status: ContractStatus.DECLINED,
        });

        const row = await rowFor(s);

        expect(row?.hasUncoveredHours).toBe(true);
        expect(row?.firstUncoveredAt).toEqual(
          new Date('2026-07-01T09:00:00.000Z'),
        );
      });

      it('answers each month on its own', async () => {
        const s = await setup(); // July entry
        await entryAt(s, '2026-08-12T09:00:00.000Z');
        await insertContract(s, JULY_TIMESHEET);

        expect((await rowFor(s, 'JUL'))?.hasUncoveredHours).toBe(false);
        const august = await rowFor(s, 'AUG');
        expect(august?.hasUncoveredHours).toBe(true);
        expect(august?.firstUncoveredAt).toEqual(
          new Date('2026-08-12T09:00:00.000Z'),
        );
      });

      it('does not count a contract of another unit or another volunteer', async () => {
        const s = await setup();
        const sibling = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sibling',
          parentId: s.root.id,
        });
        const other = await createUser(db);
        await insertContract(s, JULY_TIMESHEET, { unitId: sibling.id });
        await db.insert(schema.contracts).values({
          documentTemplateId: s.contractTemplate.id,
          volunteerId: other.id,
          reimbursementTypeId: s.reimbursementType.id,
          organizationUnitId: s.root.id,
          contractStatus: ContractStatus.ACTIVE,
          periodStart: new Date(JULY_TIMESHEET.start),
          periodEnd: new Date(JULY_TIMESHEET.end),
          resolvedBody: { header: {}, blocks: [], footer: {} },
        });

        expect((await rowFor(s))?.hasUncoveredHours).toBe(true);
      });

      it('covers an entry exactly at the contract start and not at its exclusive end', async () => {
        const atStart = await setup(); // entry at 2026-07-01T09:00Z
        await insertContract(atStart, {
          start: '2026-07-01T09:00:00.000Z',
          end: '2026-07-31T22:00:00.000Z',
        });
        const atEnd = await setup();
        await insertContract(atEnd, {
          start: '2026-06-30T22:00:00.000Z',
          end: '2026-07-01T09:00:00.000Z',
        });

        expect((await rowFor(atStart))?.hasUncoveredHours).toBe(false);
        expect((await rowFor(atEnd))?.hasUncoveredHours).toBe(true);
      });

      it('looks cover up once for the whole result, whatever the number of volunteers', async () => {
        const s = await setup();
        for (let i = 0; i < 3; i += 1) {
          const volunteer = await createUser(db);
          await createCompletedTimeEntry(db, {
            organizationUnitId: s.root.id,
            volunteerId: volunteer.id,
            reimbursementTypeId: s.reimbursementType.id,
            startedAt: new Date('2026-07-10T09:00:00.000Z'),
            endedAt: new Date('2026-07-10T11:00:00.000Z'),
          });
        }
        const spy = spyOn(contractService, 'findCoveringContracts');

        try {
          await service.findVolunteersNeedingTimesheets(
            s.root.id,
            new Date('2026-01-01T00:00:00.000Z'),
            new Date('2027-01-01T00:00:00.000Z'),
          );
          expect(spy).toHaveBeenCalledTimes(1);
        } finally {
          spy.mockRestore();
        }
      });
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

    it('rejects an AUTO_CLOSED time entry id', async () => {
      const { organization, root, reimbursementType, volunteer, supervisor } =
        await setup();
      const autoClosed = await createAutoClosedTimeEntry({
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        endedAt: new Date('2026-07-02T13:00:00.000Z'),
      });

      await expect(
        service.createInvoice(
          organization.id,
          {
            organizationUnitId: null,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            timeEntryIds: [autoClosed.id],
            periodStart: new Date('2026-07-01T00:00:00.000Z'),
            periodEnd: new Date('2026-07-31T00:00:00.000Z'),
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
    });

    // VOLI-1569: the initial yearly amount is part of the timesheet's own
    // draft, so it is written in the same transaction and never on its own.
    it('persists the initial yearly amount together with the timesheet', async () => {
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
          manualBaselineCents: 50_000,
        },
        supervisor.id,
      );

      const baseline = await db.query.reimbursementManualBaselines.findFirst({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          year: 2026,
        },
      });
      expect(baseline?.amountCents).toBe(50_000);
    });

    it('leaves the initial yearly amount untouched when none is sent', async () => {
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

      const baseline = await db.query.reimbursementManualBaselines.findFirst({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          year: 2026,
        },
      });
      expect(baseline).toBeUndefined();
    });

    it('rejects a negative initial yearly amount', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

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
            manualBaselineCents: -1,
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestGraphQLError);
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

    it('stores the rate the timesheet was issued at', async () => {
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

      expect(invoice.hourlyRateCents).toBe(1_500);
    });

    it('pays one timesheet at its own rate without moving the organisation’s', async () => {
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
          hourlyRateCents: 2_500,
        },
        supervisor.id,
      );

      expect(invoice.hourlyRateCents).toBe(2_500);
      // The payout the yearly allowance counts follows the overridden rate.
      expect(invoice.totalAmountCents).toBe(4 * 2_500);

      const stillTheOrgRate = await new ReimbursementRateService(
        db,
        new OrganizationUnitDataService(db),
        {} as MembershipService,
        { capture: () => {} } as unknown as PostHogService,
      ).getEffectiveRateCents(organization.id, null, reimbursementType.id);
      expect(stillTheOrgRate).toBe(1_500);
    });

    it('rejects a rate that is not a positive amount', async () => {
      const {
        organization,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();

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
            hourlyRateCents: 0,
          },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestGraphQLError);
    });

    it('numbers the first timesheet of a body and stores the number on it', async () => {
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
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(invoice.documentNumber).toBe('20260701-001');
      expect(invoice.documentNumberSeq).toBe(1);
      // No unit was named, so the series belongs to the organisation's root.
      expect(invoice.documentNumberScopeUnitId).toBe(root.id);
    });

    it('continues the series for the next timesheet the same body issues', async () => {
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
        startedAt: new Date('2026-08-03T09:00:00.000Z'),
        endedAt: new Date('2026-08-03T13:00:00.000Z'),
      });

      const july = await service.createInvoice(
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
      const august = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [augustEntry.id],
          periodStart: new Date('2026-08-01T00:00:00.000Z'),
          periodEnd: new Date('2026-08-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(july.documentNumber).toBe('20260701-001');
      expect(august.documentNumber).toBe('20260801-002');
      expect(august.documentNumberSeq).toBe(2);
    });

    it('restarts the series in January and keeps the year on the invoice', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const januaryEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: root.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2027-01-05T09:00:00.000Z'),
        endedAt: new Date('2027-01-05T13:00:00.000Z'),
      });

      const july = await service.createInvoice(
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
      const january = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [januaryEntry.id],
          periodStart: new Date('2027-01-01T00:00:00.000Z'),
          periodEnd: new Date('2027-01-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      expect(july.documentNumberYear).toBe(2026);
      expect(january.documentNumberYear).toBe(2027);
      expect(january.documentNumberSeq).toBe(1);
      // The year is in the number itself, so restarting cannot repeat one.
      expect(july.documentNumber).toBe('20260701-001');
      expect(january.documentNumber).toBe('20270101-001');
    });

    it('counts a sub-organisation separately from its parent', async () => {
      const {
        organization,
        root,
        type,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
      const subUnit = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        name: 'sub',
        parentId: root.id,
      });
      await addMembership(db, volunteer.id, subUnit.id);
      const subEntry = await createCompletedTimeEntry(db, {
        organizationUnitId: subUnit.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        startedAt: new Date('2026-08-03T09:00:00.000Z'),
        endedAt: new Date('2026-08-03T13:00:00.000Z'),
      });

      const atRoot = await service.createInvoice(
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
      const atSub = await service.createInvoice(
        organization.id,
        {
          organizationUnitId: subUnit.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          timeEntryIds: [subEntry.id],
          periodStart: new Date('2026-08-01T00:00:00.000Z'),
          periodEnd: new Date('2026-08-31T00:00:00.000Z'),
        },
        supervisor.id,
      );

      // Each body runs its own series, so both start at 001.
      expect(atRoot.documentNumberSeq).toBe(1);
      expect(atSub.documentNumberSeq).toBe(1);
      expect(atSub.documentNumberScopeUnitId).toBe(subUnit.id);
    });

    it('does not flag the invoice when the volunteer has an active contract', async () => {
      const {
        organization,
        root,
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
        organizationUnitId: root.id,
        contractStatus: ContractStatus.ACTIVE,
        // Covers the invoice's July 2026 period.
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-01T00:00:00.000Z'),
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

    // VOLI-1370: an ACTIVE contract for a different month is not cover for
    // this invoice's period.
    it('flags the invoice when the active contract covers a different month', async () => {
      const {
        organization,
        root,
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
        organizationUnitId: root.id,
        contractStatus: ContractStatus.ACTIVE,
        // August 2026 as Berlin bounds — the invoice is for July.
        periodStart: new Date('2026-07-31T22:00:00.000Z'),
        periodEnd: new Date('2026-08-31T22:00:00.000Z'),
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

      expect(invoice.isNonCompliant).toBe(true);
    });

    describe('compliance per time entry (VOLI-1584)', () => {
      it('is compliant when two contracts together cover every entry', async () => {
        const s = await setup();
        const second = await entryAt(s, '2026-07-20T09:00:00.000Z');
        await insertContract(s, JULY_FIRST_HALF);
        await insertContract(s, JULY_SECOND_HALF);

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id, second.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(false);
      });

      it('is non-compliant when one entry falls outside every contract', async () => {
        const s = await setup();
        const outside = await entryAt(s, '2026-07-25T09:00:00.000Z');
        await insertContract(s, JULY_FIRST_HALF);

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id, outside.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(true);
        // A partly covered timesheet is still created and persisted.
        const stored = await db.query.invoices.findFirst({
          where: { id: invoice.id },
        });
        expect(stored?.isNonCompliant).toBe(true);
      });

      it('stays compliant under one contract that spans the whole month', async () => {
        const s = await setup();
        await insertContract(s, JULY_TIMESHEET);

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(false);
      });

      it('is compliant for any month inside a Sep 2026 to Mar 2027 contract', async () => {
        const s = await setup();
        await insertContract(s, {
          start: '2026-08-31T22:00:00.000Z', // 1 Sep 2026 Berlin
          end: '2027-03-31T22:00:00.000Z', // 1 Apr 2027 Berlin, exclusive
        });
        const october = await entryAt(s, '2026-10-14T09:00:00.000Z');
        const january = await entryAt(s, '2027-01-12T09:00:00.000Z');

        const octoberSheet = await issueTimesheet(s, [october.id], {
          start: '2026-09-30T22:00:00.000Z',
          end: '2026-10-31T23:00:00.000Z',
        });
        const januarySheet = await issueTimesheet(s, [january.id], {
          start: '2026-12-31T23:00:00.000Z',
          end: '2027-01-31T23:00:00.000Z',
        });

        expect(octoberSheet.isNonCompliant).toBe(false);
        expect(januarySheet.isNonCompliant).toBe(false);
      });

      it('covers an entry exactly at the contract start and not at its exclusive end', async () => {
        const s = await setup();
        // The setup entry starts 2026-07-01T09:00Z.
        await insertContract(s, {
          start: '2026-07-01T09:00:00.000Z',
          end: '2026-07-31T22:00:00.000Z',
        });
        const atStart = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );
        expect(atStart.isNonCompliant).toBe(false);

        const t = await setup();
        await insertContract(t, {
          start: '2026-06-30T22:00:00.000Z',
          end: '2026-07-01T09:00:00.000Z', // exclusive: the entry starts here
        });
        const atEnd = await issueTimesheet(t, [t.timeEntry.id], JULY_TIMESHEET);
        expect(atEnd.isNonCompliant).toBe(true);
      });

      for (const [label, status] of [
        ['awaiting signature', ContractStatus.AWAITING_VOLUNTEER_SIGNATURE],
        ['declined', ContractStatus.DECLINED],
        ['draft', ContractStatus.DRAFT],
      ] as const) {
        it(`does not count a ${label} contract as cover`, async () => {
          const s = await setup();
          await insertContract(s, JULY_TIMESHEET, { status });

          const invoice = await issueTimesheet(
            s,
            [s.timeEntry.id],
            JULY_TIMESHEET,
          );

          expect(invoice.isNonCompliant).toBe(true);
        });
      }

      it('does not count an active contract of another unit of the organisation', async () => {
        const s = await setup();
        const sibling = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sibling',
          parentId: s.root.id,
        });
        await insertContract(s, JULY_TIMESHEET, { unitId: sibling.id });

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(true);
      });

      it('does not count an active contract of another volunteer', async () => {
        const s = await setup();
        const other = await createUser(db);
        await db.insert(schema.contracts).values({
          documentTemplateId: s.contractTemplate.id,
          volunteerId: other.id,
          reimbursementTypeId: s.reimbursementType.id,
          organizationUnitId: s.root.id,
          contractStatus: ContractStatus.ACTIVE,
          periodStart: new Date(JULY_TIMESHEET.start),
          periodEnd: new Date(JULY_TIMESHEET.end),
          resolvedBody: { header: {}, blocks: [], footer: {} },
        });

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(true);
      });

      it('does not count an active contract that has no unit', async () => {
        const s = await setup();
        await insertContract(s, JULY_TIMESHEET, { unitId: null });

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(true);
      });
    });

    describe('drafts for uncovered entries (VOLI-1584)', () => {
      it('queues one draft for the entry no contract covers and none for covered ones', async () => {
        const s = await setup();
        const outside = await entryAt(s, '2026-07-25T09:00:00.000Z');
        await insertContract(s, JULY_FIRST_HALF);

        await issueTimesheet(s, [s.timeEntry.id, outside.id], JULY_TIMESHEET);

        const drafts = await draftsOf(s);
        expect(drafts).toHaveLength(1);
        // No lifespan on the template: the draft covers the entry's year.
        expect(drafts[0]?.periodStart).toEqual(
          new Date('2025-12-31T23:00:00.000Z'),
        );
        expect(drafts[0]?.periodEnd).toEqual(
          new Date('2026-12-31T23:00:00.000Z'),
        );
      });

      it('queues nothing when two contracts together cover every entry', async () => {
        const s = await setup();
        const second = await entryAt(s, '2026-07-20T09:00:00.000Z');
        await insertContract(s, JULY_FIRST_HALF);
        await insertContract(s, JULY_SECOND_HALF);

        await issueTimesheet(s, [s.timeEntry.id, second.id], JULY_TIMESHEET);

        expect(await draftsOf(s)).toHaveLength(0);
      });

      it('queues nothing while a contract awaiting signature covers the entry', async () => {
        const s = await setup();
        await insertContract(s, JULY_TIMESHEET, {
          status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        });

        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(invoice.isNonCompliant).toBe(true);
        expect(await draftsOf(s)).toHaveLength(0);
      });

      it('queues a draft when the only covering contract was declined', async () => {
        const s = await setup();
        await insertContract(s, JULY_TIMESHEET, {
          status: ContractStatus.DECLINED,
        });

        await issueTimesheet(s, [s.timeEntry.id], JULY_TIMESHEET);

        expect(await draftsOf(s)).toHaveLength(1);
      });

      it('queues one draft per calendar year when uncovered entries span two years', async () => {
        const s = await setup();
        const december = await entryAt(s, '2026-12-20T09:00:00.000Z');
        const january = await entryAt(s, '2027-01-10T09:00:00.000Z');

        await issueTimesheet(s, [january.id, december.id], {
          start: '2026-11-30T23:00:00.000Z',
          end: '2027-01-31T23:00:00.000Z',
        });

        const drafts = (await draftsOf(s)).sort(
          (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
        );
        expect(drafts.map((d) => [d.periodStart, d.periodEnd])).toEqual([
          [
            new Date('2025-12-31T23:00:00.000Z'),
            new Date('2026-12-31T23:00:00.000Z'),
          ],
          [
            new Date('2026-12-31T23:00:00.000Z'),
            new Date('2027-12-31T23:00:00.000Z'),
          ],
        ]);
      });

      it('queues one draft for several uncovered entries of the same year', async () => {
        const s = await setup();
        const second = await entryAt(s, '2026-07-12T09:00:00.000Z');
        const third = await entryAt(s, '2026-07-26T09:00:00.000Z');

        await issueTimesheet(
          s,
          [third.id, s.timeEntry.id, second.id],
          JULY_TIMESHEET,
        );

        expect(await draftsOf(s)).toHaveLength(1);
      });

      it('queues a draft per month under a month template when two months are uncovered', async () => {
        const s = await setup();
        await setLifespan(s, '07/2026');
        const august = await entryAt(s, '2026-08-12T09:00:00.000Z');

        await issueTimesheet(s, [august.id, s.timeEntry.id], {
          start: '2026-06-30T22:00:00.000Z',
          end: '2026-08-31T22:00:00.000Z',
        });

        const drafts = (await draftsOf(s)).sort(
          (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
        );
        expect(drafts.map((d) => [d.periodStart, d.periodEnd])).toEqual([
          [
            new Date('2026-06-30T22:00:00.000Z'),
            new Date('2026-07-31T22:00:00.000Z'),
          ],
          [
            new Date('2026-07-31T22:00:00.000Z'),
            new Date('2026-08-31T22:00:00.000Z'),
          ],
        ]);
      });

      it('decides from the oldest uncovered entry first, so one year draft absorbs the later one', async () => {
        const s = await setup();
        // September 2026 to March 2027: only the October entry is inside it.
        await setLifespan(s, '01.09.2026–31.03.2027');
        const august = await entryAt(s, '2026-08-15T09:00:00.000Z');
        const october = await entryAt(s, '2026-10-14T09:00:00.000Z');

        // Newest first on purpose: the order the caller lists them in must
        // not matter. Oldest first the August entry queues the 2026 year draft
        // (the range does not contain it) and the October entry is already
        // inside it; newest first would queue the range and then the year.
        await issueTimesheet(s, [october.id, august.id], {
          start: '2026-07-31T22:00:00.000Z',
          end: '2026-10-31T23:00:00.000Z',
        });

        const drafts = await draftsOf(s);
        expect(drafts).toHaveLength(1);
        expect(drafts[0]?.periodStart).toEqual(
          new Date('2025-12-31T23:00:00.000Z'),
        );
        expect(drafts[0]?.periodEnd).toEqual(
          new Date('2026-12-31T23:00:00.000Z'),
        );
      });

      it('does not ask for a draft for entries a non-declined contract already covers', async () => {
        const s = await setup();
        const second = await entryAt(s, '2026-07-12T09:00:00.000Z');
        const third = await entryAt(s, '2026-07-26T09:00:00.000Z');
        await insertContract(s, JULY_TIMESHEET, {
          status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        });
        const spy = spyOn(contractService, 'ensureDraftContract');

        try {
          const invoice = await issueTimesheet(
            s,
            [s.timeEntry.id, second.id, third.id],
            JULY_TIMESHEET,
          );
          // Not compliant, so the empty call list is down to the pre-filter
          // and not to there being nothing uncovered.
          expect(invoice.isNonCompliant).toBe(true);
          expect(spy).not.toHaveBeenCalled();
        } finally {
          spy.mockRestore();
        }
      });

      it('asks for drafts one at a time, oldest entry first', async () => {
        const s = await setup();
        const december = await entryAt(s, '2026-12-20T09:00:00.000Z');
        const january = await entryAt(s, '2027-01-10T09:00:00.000Z');
        const original =
          contractService.ensureDraftContract.bind(contractService);
        let inFlight = 0;
        let mostInFlight = 0;
        const anchors: number[] = [];
        const spy = spyOn(contractService, 'ensureDraftContract');
        spy.mockImplementation(async (...args) => {
          anchors.push(args[1].anchorDate.getTime());
          inFlight += 1;
          mostInFlight = Math.max(mostInFlight, inFlight);
          try {
            return await original(...args);
          } finally {
            inFlight -= 1;
          }
        });

        try {
          await issueTimesheet(s, [january.id, december.id], {
            start: '2026-11-30T23:00:00.000Z',
            end: '2027-01-31T23:00:00.000Z',
          });
        } finally {
          spy.mockRestore();
        }

        expect(anchors).toEqual([
          new Date('2026-12-20T09:00:00.000Z').getTime(),
          new Date('2027-01-10T09:00:00.000Z').getTime(),
        ]);
        expect(mostInFlight).toBe(1);
      });

      it('writes nothing when the organisation has no contract template to draft from', async () => {
        const s = await setup();
        await db
          .update(schema.documentTemplates)
          .set({ isDeleted: true })
          .where(eq(schema.documentTemplates.id, s.contractTemplate.id));

        await expect(
          issueTimesheet(s, [s.timeEntry.id], JULY_TIMESHEET),
        ).rejects.toThrow();

        const invoices = await db.query.invoices.findMany({
          where: { volunteerId: s.volunteer.id },
        });
        expect(invoices).toHaveLength(0);
        expect(await draftsOf(s)).toHaveLength(0);
      });

      it('queues the draft in the invoice unit when a contract of the root unit is the only cover', async () => {
        const s = await setup();
        const sub = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sub',
          parentId: s.root.id,
        });
        const entry = await createCompletedTimeEntry(db, {
          organizationUnitId: sub.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          startedAt: new Date('2026-07-10T09:00:00.000Z'),
          endedAt: new Date('2026-07-10T11:00:00.000Z'),
        });
        await insertContract(s, JULY_TIMESHEET, { unitId: s.root.id });

        const invoice = await issueTimesheet(
          s,
          [entry.id],
          JULY_TIMESHEET,
          sub.id,
        );

        expect(invoice.isNonCompliant).toBe(true);
        const drafts = await draftsOf(s);
        expect(drafts).toHaveLength(1);
        expect(drafts[0]?.organizationUnitId).toBe(sub.id);
      });

      it('is compliant in a sub unit when a contract of that unit covers the entry', async () => {
        const s = await setup();
        const sub = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sub',
          parentId: s.root.id,
        });
        const entry = await createCompletedTimeEntry(db, {
          organizationUnitId: sub.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          startedAt: new Date('2026-07-10T09:00:00.000Z'),
          endedAt: new Date('2026-07-10T11:00:00.000Z'),
        });
        await insertContract(s, JULY_TIMESHEET, { unitId: sub.id });

        const invoice = await issueTimesheet(
          s,
          [entry.id],
          JULY_TIMESHEET,
          sub.id,
        );

        expect(invoice.isNonCompliant).toBe(false);
        expect(await draftsOf(s)).toHaveLength(0);
      });
    });

    describe('findInvoiceIdsWithoutActiveCover (VOLI-1588)', () => {
      it('flags an invoice whose hours have no ACTIVE contract and clears it once one is active', async () => {
        const s = await setup();
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );

        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));

        await insertContract(s, JULY_TIMESHEET);

        // The stored snapshot still says non-compliant; the live answer moved.
        const stored = await db.query.invoices.findFirst({
          where: { id: invoice.id },
        });
        expect(stored?.isNonCompliant).toBe(true);
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set());
      });

      it('does not count a contract awaiting signature as cover', async () => {
        const s = await setup();
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );
        await insertContract(s, JULY_TIMESHEET, {
          status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        });

        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));
      });

      it('is judged per claimed hour, so two contracts that together cover the month clear it', async () => {
        const s = await setup();
        const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id, late.id],
          JULY_TIMESHEET,
        );
        await insertContract(s, JULY_FIRST_HALF);
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));

        await insertContract(s, JULY_SECOND_HALF);
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set());
      });

      it('answers a whole list with one cover lookup and ignores unknown ids', async () => {
        const a = await setup();
        const b = await setup();
        const invoiceA = await issueTimesheet(
          a,
          [a.timeEntry.id],
          JULY_TIMESHEET,
        );
        const invoiceB = await issueTimesheet(
          b,
          [b.timeEntry.id],
          JULY_TIMESHEET,
        );
        await insertContract(b, JULY_TIMESHEET);
        const spy = spyOn(contractService, 'findCoveringContracts');

        try {
          const flagged = await service.findInvoiceIdsWithoutActiveCover([
            invoiceA.id,
            invoiceB.id,
            crypto.randomUUID(),
          ]);
          expect(flagged).toEqual(new Set([invoiceA.id]));
          expect(spy).toHaveBeenCalledTimes(1);
        } finally {
          spy.mockRestore();
        }
      });

      it('judges an org-wide invoice, which stores no unit, in the unit of its claimed entries', async () => {
        const s = await setup();
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );
        const stored = await db.query.invoices.findFirst({
          where: { id: invoice.id },
        });
        expect(stored?.organizationUnitId).toBeNull();

        await insertContract(s, JULY_TIMESHEET, { unitId: s.root.id });

        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set());
      });

      it('judges a unit-scoped invoice in its own unit, not in the root unit', async () => {
        const s = await setup();
        const sub = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sub',
          parentId: s.root.id,
        });
        const entry = await createCompletedTimeEntry(db, {
          organizationUnitId: sub.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          startedAt: new Date('2026-07-10T09:00:00.000Z'),
          endedAt: new Date('2026-07-10T11:00:00.000Z'),
        });
        const invoice = await issueTimesheet(
          s,
          [entry.id],
          JULY_TIMESHEET,
          sub.id,
        );
        const stored = await db.query.invoices.findFirst({
          where: { id: invoice.id },
        });
        expect(stored?.organizationUnitId).toBe(sub.id);

        await insertContract(s, JULY_TIMESHEET, { unitId: s.root.id });
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));

        await insertContract(s, JULY_TIMESHEET, { unitId: sub.id });
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set());
      });

      it('ignores a claim that was released, so it does not hold the invoice non-compliant', async () => {
        const s = await setup();
        const late = await entryAt(s, '2026-07-20T09:00:00.000Z');
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id, late.id],
          JULY_TIMESHEET,
        );
        await insertContract(s, JULY_FIRST_HALF);
        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));

        await db
          .update(schema.invoiceTimeEntries)
          .set({ released: true })
          .where(eq(schema.invoiceTimeEntries.timeEntryId, late.id));

        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set());
      });

      it('matches in the invoice unit, so another unit’s contract does not count', async () => {
        const s = await setup();
        const sibling = await createUnit(db, {
          organizationId: s.organization.id,
          typeId: s.type.id,
          name: 'sibling',
          parentId: s.root.id,
        });
        const invoice = await issueTimesheet(
          s,
          [s.timeEntry.id],
          JULY_TIMESHEET,
        );
        await insertContract(s, JULY_TIMESHEET, { unitId: sibling.id });

        expect(
          await service.findInvoiceIdsWithoutActiveCover([invoice.id]),
        ).toEqual(new Set([invoice.id]));
      });
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

    it('issues a second timesheet for hours tracked after the first went out', async () => {
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

      // Hours arrive across a month. Refusing the second document stranded
      // them: no period both surfaces hours tracked after the first went out
      // and avoids overlapping it (VOLI-1469).
      const second = await service.createInvoice(
        organization.id,
        { ...period, timeEntryIds: [otherEntry.id] },
        supervisor.id,
      );

      const invoices = await db.query.invoices.findMany({
        where: { volunteerId: volunteer.id },
      });
      expect(invoices).toHaveLength(2);
      // Each document carries only its own hours, and its own number.
      expect(second.totalHours).toBe(2);
      const numbers = invoices.map((invoice) => invoice.documentNumber);
      expect(new Set(numbers).size).toBe(2);
    });

    it('still refuses hours another timesheet already claimed', async () => {
      const {
        organization,
        root,
        reimbursementType,
        volunteer,
        supervisor,
        timeEntry,
      } = await setup();
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

      // Allowing a second document for the month must not let the same hour
      // be paid twice — that rule moved from the period guard to the claim.
      await expect(
        service.createInvoice(
          organization.id,
          { ...period, timeEntryIds: [timeEntry.id] },
          supervisor.id,
        ),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
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

    it('queues one year draft that covers every uncovered month of that year', async () => {
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
      // VOLI-1585: with no lifespan on the template a draft covers the entry's
      // calendar year, so the July timesheet queues one draft and the August
      // one is already inside it (VOLI-1370 expected one draft per month).
      expect(contracts).toHaveLength(1);
      expect(contracts[0]?.contractStatus).toBe(ContractStatus.DRAFT);
      expect(contracts[0]?.periodStart).toEqual(
        new Date('2025-12-31T23:00:00.000Z'),
      );
      expect(contracts[0]?.periodEnd).toEqual(
        new Date('2026-12-31T23:00:00.000Z'),
      );
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
        organizationUnitId: root.id,
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

  describe('ensurePdf (VOLI-1637)', () => {
    const issueTimesheet = async () => {
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
      renderCalls.length = 0;
      return { invoice, supervisor };
    };

    it('renders the PDF of an invoice that has none and returns its id', async () => {
      const { invoice, supervisor } = await issueTimesheet();
      renderedFileId = 'rendered-file';

      const fileId = await service.ensurePdf(invoice.id, supervisor.id);

      expect(fileId).toBe('rendered-file');
      expect(renderCalls).toEqual([
        { invoiceId: invoice.id, actorUserId: supervisor.id },
      ]);
      renderedFileId = null;
    });

    it('returns null when rendering fails again', async () => {
      const { invoice, supervisor } = await issueTimesheet();

      expect(await service.ensurePdf(invoice.id, supervisor.id)).toBeNull();
    });
  });

  describe('signInvoice', () => {
    const issueForSigning = async () => {
      const f = await setup();
      const invoice = await service.createInvoice(
        f.organization.id,
        {
          organizationUnitId: null,
          volunteerId: f.volunteer.id,
          reimbursementTypeId: f.reimbursementType.id,
          timeEntryIds: [f.timeEntry.id],
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-31T00:00:00.000Z'),
        },
        f.supervisor.id,
      );
      return { ...f, invoice };
    };
    const stored = (id: string) =>
      db.query.invoices.findFirst({ where: { id } });

    it('freezes the render inputs when the volunteer signs and keeps them through the countersignature (VOLI-1637)', async () => {
      const { root, invoice, volunteer, supervisor } = await issueForSigning();
      expect((await stored(invoice.id))?.renderInputs).toBeNull();

      await service.signInvoice(invoice.id, volunteer.id, root.id);
      const frozen = (await stored(invoice.id))?.renderInputs;
      expect(frozen).toEqual({
        values: { resolution: expect.any(String) },
      });

      await service.signInvoice(invoice.id, supervisor.id, root.id);
      expect((await stored(invoice.id))?.renderInputs).toEqual(frozen);
    });

    it('drops the PDF of the previous step when a signature is added (VOLI-1637)', async () => {
      const { invoice, root, volunteer } = await issueForSigning();
      const previous = await createDocumentFile(db, {
        organizationUnitId: root.id,
        uploadedByUserId: volunteer.id,
      });
      await db
        .update(schema.invoices)
        .set({ fileId: previous.id })
        .where(eq(schema.invoices.id, invoice.id));

      await service.signInvoice(invoice.id, volunteer.id, root.id);

      // Rendering the new PDF failed (the stub returns null): no stale PDF
      // without the new signature is left in its place.
      expect((await stored(invoice.id))?.fileId).toBeNull();
    });

    it('marks claimed time entries as paid once the invoice reaches READY', async () => {
      const {
        root,
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
        root.id,
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
        root.id,
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
        root,
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
        root.id,
      );

      expect(declined.invoiceStatus).toBe(InvoiceStatus.DECLINED);
      expect(declined.declineReason).toBe('Wrong hours');
      expect(declined.declinedAtSigneeType).toBe(SigneeType.VOLUNTEER);
    });

    it('notifies the admin side when the volunteer declines (VOLI-1246)', async () => {
      const {
        root,
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
      await service.declineInvoice(
        invoice.id,
        volunteer.id,
        'Wrong hours',
        root.id,
      );

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
        root,
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

      const pending = await service.findPendingInvoiceSignee(
        invoice.id,
        root.id,
      );
      expect(pending).toEqual({
        signeeType: SigneeType.VOLUNTEER,
        userId: volunteer.id,
      });
    });

    it('returns null once the invoice is fully signed', async () => {
      const {
        root,
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
      await service.signInvoice(invoice.id, volunteer.id, root.id);
      await service.signInvoice(invoice.id, supervisor.id, root.id);

      const pending = await service.findPendingInvoiceSignee(
        invoice.id,
        root.id,
      );
      expect(pending).toBeNull();
    });
  });
});

import { beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  SigneeType,
} from '../src/accounting/enums';
import type { DocumentTemplateBody } from '../src/accounting/schemas/document-template.schema';
import { ContractService } from '../src/accounting/services/contract.service';
import { DocumentNotificationService } from '../src/accounting/services/document-notification.service';
import { DocumentProfileRequirementService } from '../src/accounting/services/document-profile-requirement.service';
import { DocumentRenderingService } from '../src/accounting/services/document-rendering.service';
import { DocumentSigningService } from '../src/accounting/services/document-signing.service';
import { DocumentTemplateService } from '../src/accounting/services/document-template.service';
import {
  findManualFieldValue,
  type TemplateBodyShape,
} from '../src/accounting/services/document-template.types';
import {
  billingMonthBoundsOf,
  billingYearBounds,
} from '../src/accounting/utils/billing-period';
import {
  ContractCover,
  type CoverageTarget,
} from '../src/accounting/utils/contract-coverage';
import { AuthService } from '../src/auth/auth.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import {
  ConflictGraphQLError,
  ForbiddenGraphQLError,
  NotFoundGraphQLError,
} from '../src/graphql/errors';
import { MembershipService } from '../src/membership/membership.service';
import { NotificationService } from '../src/notification';
import { OrganizationMapper } from '../src/organization/mappers/organization.mapper';
import { OrganizationService } from '../src/organization/organization.service';
import { OrganizationUnitService } from '../src/organization/organization-unit.service';
import { OrganizationUnitDataService } from '../src/organization/organization-unit-data.service';
import { PostHogService } from '../src/shared/observability/posthog.service';
import { startOfAppDay } from '../src/shift/utils/app-time';
import { FileService } from '../src/storage/services/file.service';
import {
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
import { createUser } from './factories/user.factory';
import {
  ensureTestDatabase,
  registerTestResourceCleanup,
} from './helpers/ensure-test-database';

describe('ContractService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: ContractService;
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
    service = new ContractService(
      db,
      documentTemplateService,
      documentSigningService,
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

  /** Org + root unit + a volunteer -> permission-holder contract template, with one authorized signer. */
  const setup = async (
    options: { contractBody?: DocumentTemplateBody } = {},
  ) => {
    const reimbursementType = await createReimbursementType(db);
    const { organization, type } = await createOrganizationWithType(
      db,
      `Contract Org ${crypto.randomUUID()}`,
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
    const signer = await createUser(db);
    const signerMembership = await addMembership(db, signer.id, root.id);
    await assignRoleToMembership(db, {
      membershipId: signerMembership.id,
      roleId: role.id,
    });
    const template = await createTwoStepTemplate(db, {
      organizationId: organization.id,
      reimbursementTypeId: reimbursementType.id,
      kind: DocumentKind.CONTRACT,
      requiredPermissionId: permission.id,
      signeeTypes: [SigneeType.VOLUNTEER, SigneeType.PERMISSION_HOLDER],
      body: options.contractBody,
    });
    const volunteer = await createUser(db);

    return {
      organization,
      type,
      root,
      reimbursementType,
      template,
      signer,
      volunteer,
    };
  };

  const OCTOBER = {
    periodStart: startOfAppDay(2026, 9, 1),
    periodEnd: startOfAppDay(2026, 10, 1),
  };

  /** Inserted directly so status and createdAt are exactly what the test states. */
  const insertContract = async (args: {
    templateId: string;
    volunteerId: string;
    reimbursementTypeId: string;
    organizationUnitId: string | null;
    status: ContractStatus;
    periodStart: Date;
    periodEnd: Date;
    createdAt?: Date;
  }) => {
    const [row] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: args.templateId,
        volunteerId: args.volunteerId,
        reimbursementTypeId: args.reimbursementTypeId,
        organizationUnitId: args.organizationUnitId,
        contractStatus: args.status,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        resolvedBody: { header: {}, blocks: [], footer: {} },
        ...(args.createdAt ? { createdAt: args.createdAt } : {}),
      })
      .returning();
    return row;
  };

  /** A contract template whose Vertragslaufzeit field holds `value`, quoted twice like the preset. */
  const bodyWithLifespan = (value: string): DocumentTemplateBody => ({
    header: {
      metaLines: [
        {
          id: 'meta',
          text: 'Laufzeit {lifespan}',
          fields: [
            {
              id: 'contract-lifespan',
              value: { kind: 'manual-template', value },
            },
          ],
        },
      ],
    },
    blocks: [
      {
        id: 'terms',
        lines: [
          {
            id: 'term',
            text: 'Gültig {lifespan}',
            fields: [
              {
                id: 'contract-lifespan',
                value: { kind: 'manual-template', value },
              },
            ],
          },
        ],
      },
    ],
    footer: {},
  });

  describe('findContract', () => {
    it('returns signatures in signing order regardless of insertion order', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
        },
        signer.id,
      );

      // Rewrite rows coordinator-first: same `order` values, reversed
      // physical insertion order (VOLI-1347).
      const rows = await db.query.contractSignatures.findMany({
        where: { contractId: contract.id },
      });
      await db
        .delete(schema.contractSignatures)
        .where(eq(schema.contractSignatures.contractId, contract.id));
      for (const row of [...rows].reverse()) {
        await db.insert(schema.contractSignatures).values({
          contractId: row.contractId,
          order: row.order,
          signeeType: row.signeeType,
          requiredPermissionId: row.requiredPermissionId,
        });
      }

      const found = await service.findContract(contract.id);
      expect(found.signatures.map((s) => s.order)).toEqual([0, 1]);
      expect(found.signatures.map((s) => s.signeeType)).toEqual([
        SigneeType.VOLUNTEER,
        SigneeType.PERMISSION_HOLDER,
      ]);
    });
  });

  describe('createContract', () => {
    it('starts at the first signee step and records a CREATED event', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();

      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
        },
        signer.id,
      );

      expect(contract.contractStatus).toBe(
        ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      );

      const statusChanges = await service.findContractStatusChanges(
        contract.id,
      );
      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].type).toBe(DocumentStatusChange.CREATED);
    });

    it('snapshots the template body onto the contract', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();

      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      expect(contract.resolvedBody).toEqual({
        header: {},
        blocks: [],
        footer: {},
      });
    });

    it('persists per-document field overrides', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();

      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
          fieldOverrides: [
            {
              fieldId: 'volunteer-iban-field',
              value: 'DE00 0000 0000 0000 0000 00',
            },
          ],
        },
        signer.id,
      );

      expect(contract.fieldOverrides).toEqual({
        'volunteer-iban-field': 'DE00 0000 0000 0000 0000 00',
      });
    });

    it('replaces the auto-queued draft for the same volunteer, type and year', async () => {
      const { organization, root, reimbursementType, volunteer, signer } =
        await setup();
      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2026-06-15T12:00:00.000Z'),
        },
        signer.id,
      );
      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);

      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          // The Berlin calendar year, so it fully contains the year draft.
          periodStart: billingYearBounds(2026).start,
          periodEnd: billingYearBounds(2026).end,
        },
        signer.id,
      );

      const remaining = await db.query.contracts.findMany({
        where: {
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
        },
      });
      expect(remaining.map((c) => c.id)).toEqual([contract.id]);
      expect(contract.contractStatus).toBe(
        ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      );

      const statusChanges = await db.query.contractStatusChanges.findMany({
        where: { contractId: contract.id },
      });
      expect(statusChanges.map((c) => c.type)).toEqual(
        expect.arrayContaining([
          DocumentStatusChange.CREATED,
          DocumentStatusChange.DRAFT_SUPERSEDED,
        ]),
      );
    });

    it("does not delete another organization's draft for the same volunteer and type", async () => {
      // Reimbursement types are global (not per-org), so two orgs' templates
      // can target the same type. A volunteer with a draft in one org must
      // not have it swept up when a contract is created for them in another.
      const reimbursementType = await createReimbursementType(db);
      const buildOrg = async () => {
        const { organization, type } = await createOrganizationWithType(
          db,
          `Contract Org ${crypto.randomUUID()}`,
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
        const signer = await createUser(db);
        const signerMembership = await addMembership(db, signer.id, root.id);
        await assignRoleToMembership(db, {
          membershipId: signerMembership.id,
          roleId: role.id,
        });
        await createTwoStepTemplate(db, {
          organizationId: organization.id,
          reimbursementTypeId: reimbursementType.id,
          kind: DocumentKind.CONTRACT,
          requiredPermissionId: permission.id,
          signeeTypes: [SigneeType.VOLUNTEER, SigneeType.PERMISSION_HOLDER],
        });
        return { organization, signer };
      };

      const orgA = await buildOrg();
      const orgB = await buildOrg();
      const volunteer = await createUser(db);

      const draftInOrgB = await service.ensureDraftContract(
        orgB.organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2026-06-15T12:00:00.000Z'),
        },
        orgB.signer.id,
      );
      expect(draftInOrgB?.contractStatus).toBe(ContractStatus.DRAFT);

      await service.createContract(
        orgA.organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
        },
        orgA.signer.id,
      );

      const kept = await db.query.contracts.findFirst({
        where: { id: draftInOrgB?.id },
      });
      expect(kept?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('keeps a draft queued for a different year', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2027-06-15T12:00:00.000Z'),
        },
        signer.id,
      );

      await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
        },
        signer.id,
      );

      const kept = await db.query.contracts.findFirst({
        where: { id: draft?.id },
      });
      expect(kept?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    // VOLI-1370: a contract issued for one month must not stop the system
    // from queuing one for a later, uncovered date.
    it('queues a draft for a date no existing contract covers', async () => {
      const { organization, root, reimbursementType, volunteer, signer } =
        await setup();
      await service.createContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          // August 2026 as Berlin bounds.
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
        signer.id,
      );

      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2026-09-15T12:00:00.000Z'),
        },
        signer.id,
      );

      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
      // VOLI-1585: with no lifespan on the template the draft covers the
      // calendar year of the entry, not just its month.
      expect(draft?.periodStart).toEqual(billingYearBounds(2026).start);
      expect(draft?.periodEnd).toEqual(billingYearBounds(2026).end);
    });

    it('does not queue a draft when an existing contract covers the anchor date', async () => {
      const { organization, root, reimbursementType, volunteer, signer } =
        await setup();
      await service.createContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
        signer.id,
      );

      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2026-08-15T12:00:00.000Z'),
        },
        signer.id,
      );

      expect(draft).toBeUndefined();
    });
  });

  describe('signContract', () => {
    it('walks the contract through the full signing chain to ACTIVE', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      const afterVolunteer = await service.signContract(
        contract.id,
        volunteer.id,
      );
      expect(afterVolunteer.contractStatus).toBe(
        ContractStatus.AWAITING_NGO_SIGNATURE,
      );

      const afterCountersign = await service.signContract(
        contract.id,
        signer.id,
      );
      expect(afterCountersign.contractStatus).toBe(ContractStatus.ACTIVE);

      const statusChanges = await service.findContractStatusChanges(
        contract.id,
      );
      expect(statusChanges.map((e) => e.type)).toEqual([
        DocumentStatusChange.CREATED,
        DocumentStatusChange.SIGNED,
        DocumentStatusChange.COUNTERSIGNED,
        DocumentStatusChange.ACTIVATED,
      ]);
    });

    it('forbids a user who is not the volunteer from signing the first step', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      await expect(
        service.signContract(contract.id, signer.id),
      ).rejects.toBeInstanceOf(ForbiddenGraphQLError);
    });

    it('throws ConflictGraphQLError when signing a contract that is already ACTIVE', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );
      await service.signContract(contract.id, volunteer.id);
      await service.signContract(contract.id, signer.id);

      await expect(
        service.signContract(contract.id, signer.id),
      ).rejects.toBeInstanceOf(ConflictGraphQLError);
    });
  });

  describe('declineContract', () => {
    it('requires a non-empty reason', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      await expect(
        service.declineContract(contract.id, volunteer.id, '   '),
      ).rejects.toThrow();
    });

    it('records the decline reason, actor and signee type', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      const declined = await service.declineContract(
        contract.id,
        volunteer.id,
        'Terms are not acceptable',
      );

      expect(declined.contractStatus).toBe(ContractStatus.DECLINED);
      expect(declined.declineReason).toBe('Terms are not acceptable');
      expect(declined.declinedByUserId).toBe(volunteer.id);
      expect(declined.declinedAtSigneeType).toBe(SigneeType.VOLUNTEER);

      const statusChanges = await service.findContractStatusChanges(
        contract.id,
      );
      expect(statusChanges.at(-1)?.type).toBe(DocumentStatusChange.DECLINED);
    });

    it('notifies the admin side when the volunteer declines (VOLI-1246)', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        signer.id,
      );

      const before = declinedByVolunteerCalls.length;
      await service.declineContract(
        contract.id,
        volunteer.id,
        'Terms are not acceptable',
      );

      expect(declinedByVolunteerCalls.length).toBe(before + 1);
      expect(declinedByVolunteerCalls.at(-1)).toMatchObject({
        organizationId: organization.id,
        volunteerUserId: volunteer.id,
        documentId: contract.id,
        documentKind: DocumentKind.CONTRACT,
        reason: 'Terms are not acceptable',
      });
    });
  });

  describe('findActiveContract', () => {
    it('ignores an ACTIVE contract whose period has already ended', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2020-01-01T00:00:00.000Z'),
          periodEnd: new Date('2020-12-31T00:00:00.000Z'),
        },
        signer.id,
      );
      await service.signContract(contract.id, volunteer.id);
      await service.signContract(contract.id, signer.id);

      const active = await service.findActiveContract(
        volunteer.id,
        reimbursementType.id,
      );
      expect(active).toBeUndefined();
    });

    it('finds an ACTIVE contract whose period covers today', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date(Date.now() - 86_400_000),
          periodEnd: new Date(Date.now() + 86_400_000),
        },
        signer.id,
      );
      await service.signContract(contract.id, volunteer.id);
      await service.signContract(contract.id, signer.id);

      const active = await service.findActiveContract(
        volunteer.id,
        reimbursementType.id,
      );
      expect(active?.id).toBe(contract.id);
    });

    // VOLI-1370: a month-scoped contract only covers its own month.
    it('only covers the target period the contract states', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const contract = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          // August 2026 as Berlin bounds.
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
        signer.id,
      );
      await service.signContract(contract.id, volunteer.id);
      await service.signContract(contract.id, signer.id);

      const august = await service.findActiveContract(
        volunteer.id,
        reimbursementType.id,
        {
          // August 2026 as Berlin bounds.
          start: new Date('2026-07-31T22:00:00.000Z'),
          end: new Date('2026-08-31T22:00:00.000Z'),
        },
      );
      expect(august?.id).toBe(contract.id);

      const september = await service.findActiveContract(
        volunteer.id,
        reimbursementType.id,
        {
          start: new Date('2026-08-31T22:00:00.000Z'),
          end: new Date('2026-09-30T22:00:00.000Z'),
        },
      );
      expect(september).toBeUndefined();

      // Overlap is not cover: a two-month (August–September) timesheet is not
      // fully covered by an August-only contract.
      const twoMonths = await service.findActiveContract(
        volunteer.id,
        reimbursementType.id,
        {
          start: new Date('2026-07-31T22:00:00.000Z'),
          end: new Date('2026-09-30T22:00:00.000Z'),
        },
      );
      expect(twoMonths).toBeUndefined();
    });
  });

  describe('findCoveringContracts', () => {
    const noonOn = (day: number) =>
      new Date(startOfAppDay(2026, 9, day).getTime() + 12 * 3_600_000);

    it('returns the active contracts covering each entry, newest first', async () => {
      const { root, reimbursementType, template, volunteer } = await setup();
      const base = {
        templateId: template.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        status: ContractStatus.ACTIVE,
      };
      const month = await insertContract({
        ...base,
        ...OCTOBER,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
      });
      const week = await insertContract({
        ...base,
        periodStart: startOfAppDay(2026, 9, 5),
        periodEnd: startOfAppDay(2026, 9, 12),
        createdAt: new Date('2026-09-20T10:00:00.000Z'),
      });
      const target = (key: string, at: Date): CoverageTarget => ({
        key,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        at,
      });

      const result = await service.findCoveringContracts([
        target('in-week', noonOn(7)),
        target('after-week', noonOn(20)),
        target('on-period-end', OCTOBER.periodEnd),
      ]);

      expect(result.get('in-week')?.map((c) => c.id)).toEqual([
        week.id,
        month.id,
      ]);
      expect(result.get('after-week')?.map((c) => c.id)).toEqual([month.id]);
      expect(result.get('on-period-end')).toEqual([]);
    });

    it('resolves many entries with a single query and none for an empty list', async () => {
      const { root, reimbursementType, template, volunteer } = await setup();
      await insertContract({
        templateId: template.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        status: ContractStatus.ACTIVE,
        ...OCTOBER,
      });
      const targets: CoverageTarget[] = Array.from({ length: 25 }, (_, i) => ({
        key: `entry-${i}`,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        at: noonOn(i + 1),
      }));

      const findMany = spyOn(db.query.contracts, 'findMany');
      try {
        const result = await service.findCoveringContracts(targets);
        expect(findMany).toHaveBeenCalledTimes(1);
        expect(result.size).toBe(25);
        expect([...result.values()].every((list) => list.length === 1)).toBe(
          true,
        );

        const empty = await service.findCoveringContracts([]);
        expect(empty.size).toBe(0);
        expect(findMany).toHaveBeenCalledTimes(1);
      } finally {
        findMany.mockRestore();
      }
    });

    it('ignores contracts of a sibling unit, of another organization and without a unit', async () => {
      const {
        organization,
        type,
        root,
        reimbursementType,
        template,
        volunteer,
      } = await setup();
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        name: 'sibling',
        parentId: root.id,
      });
      // Reimbursement types are global, so a second setup shares the type row.
      const other = await setup();
      expect(other.reimbursementType.id).toBe(reimbursementType.id);
      const shared = {
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        status: ContractStatus.ACTIVE,
        ...OCTOBER,
      };
      await insertContract({
        ...shared,
        templateId: template.id,
        organizationUnitId: sibling.id,
      });
      await insertContract({
        ...shared,
        templateId: template.id,
        organizationUnitId: null,
      });
      await insertContract({
        ...shared,
        templateId: other.template.id,
        organizationUnitId: other.root.id,
      });
      // Positive control: the same scope as the entry, so an empty result can't
      // be an unrelated query mistake.
      const matching = await insertContract({
        ...shared,
        templateId: template.id,
        organizationUnitId: root.id,
      });

      const result = await service.findCoveringContracts([
        {
          key: 'entry',
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          organizationUnitId: root.id,
          at: noonOn(15),
        },
      ]);

      expect(result.get('entry')?.map((c) => c.id)).toEqual([matching.id]);
    });

    it('keeps each entry with its own volunteer and unit when resolved together', async () => {
      const {
        organization,
        type,
        root,
        reimbursementType,
        template,
        volunteer,
      } = await setup();
      const child = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        name: 'child',
        parentId: root.id,
      });
      const otherVolunteer = await createUser(db);
      const base = {
        templateId: template.id,
        reimbursementTypeId: reimbursementType.id,
        status: ContractStatus.ACTIVE,
        ...OCTOBER,
      };
      const aInRoot = await insertContract({
        ...base,
        volunteerId: volunteer.id,
        organizationUnitId: root.id,
      });
      const bInChild = await insertContract({
        ...base,
        volunteerId: otherVolunteer.id,
        organizationUnitId: child.id,
      });
      const target = (
        key: string,
        volunteerId: string,
        organizationUnitId: string,
      ): CoverageTarget => ({
        key,
        volunteerId,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId,
        at: noonOn(15),
      });

      const result = await service.findCoveringContracts([
        target('a-root', volunteer.id, root.id),
        target('b-child', otherVolunteer.id, child.id),
        target('a-child', volunteer.id, child.id),
        target('b-root', otherVolunteer.id, root.id),
      ]);

      expect(result.get('a-root')?.map((c) => c.id)).toEqual([aInRoot.id]);
      expect(result.get('b-child')?.map((c) => c.id)).toEqual([bInChild.id]);
      expect(result.get('a-child')).toEqual([]);
      expect(result.get('b-root')).toEqual([]);
    });

    it('counts a draft and an awaiting-signature contract as open cover only, and never a declined one', async () => {
      const { root, reimbursementType, template, volunteer } = await setup();
      const base = {
        templateId: template.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        ...OCTOBER,
      };
      const draft = await insertContract({
        ...base,
        status: ContractStatus.DRAFT,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
      });
      const awaiting = await insertContract({
        ...base,
        status: ContractStatus.AWAITING_NGO_SIGNATURE,
        createdAt: new Date('2026-09-02T10:00:00.000Z'),
      });
      await insertContract({ ...base, status: ContractStatus.DECLINED });
      const targets: CoverageTarget[] = [
        {
          key: 'entry',
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          organizationUnitId: root.id,
          at: noonOn(15),
        },
      ];

      const active = await service.findCoveringContracts(targets);
      const open = await service.findCoveringContracts(
        targets,
        ContractCover.OPEN,
      );

      expect(active.get('entry')).toEqual([]);
      expect(open.get('entry')?.map((c) => c.id)).toEqual([
        awaiting.id,
        draft.id,
      ]);
    });

    it('covers entries in both years of a contract running Sep 2026 to Mar 2027', async () => {
      const { root, reimbursementType, template, volunteer } = await setup();
      const crossYear = await insertContract({
        templateId: template.id,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        status: ContractStatus.ACTIVE,
        periodStart: startOfAppDay(2026, 8, 1),
        periodEnd: startOfAppDay(2027, 3, 1),
      });
      const target = (key: string, at: Date): CoverageTarget => ({
        key,
        volunteerId: volunteer.id,
        reimbursementTypeId: reimbursementType.id,
        organizationUnitId: root.id,
        at,
      });

      const result = await service.findCoveringContracts([
        target(
          'december',
          new Date(startOfAppDay(2026, 11, 15).getTime() + 12 * 3_600_000),
        ),
        target(
          'january',
          new Date(startOfAppDay(2027, 0, 15).getTime() + 12 * 3_600_000),
        ),
        target(
          'august',
          new Date(startOfAppDay(2026, 7, 15).getTime() + 12 * 3_600_000),
        ),
      ]);

      expect(result.get('december')?.map((c) => c.id)).toEqual([crossYear.id]);
      expect(result.get('january')?.map((c) => c.id)).toEqual([crossYear.id]);
      expect(result.get('august')).toEqual([]);
    });
  });

  describe('ensureDraftContract', () => {
    const draftFor = async (
      s: Awaited<ReturnType<typeof setup>>,
      anchorDate: Date,
    ) =>
      service.ensureDraftContract(
        s.organization.id,
        {
          organizationUnitId: s.root.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          anchorDate,
        },
        s.signer.id,
      );

    const lifespanOf = (body: unknown) =>
      findManualFieldValue(body as TemplateBodyShape, 'contract-lifespan');

    it('covers the anchor year when the template says a year', async () => {
      const s = await setup({ contractBody: bodyWithLifespan('2026') });
      const draft = await draftFor(s, new Date('2027-03-10T10:00:00.000Z'));

      const year = billingYearBounds(2027);
      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
      expect(draft?.periodStart).toEqual(year.start);
      expect(draft?.periodEnd).toEqual(year.end);
      expect(draft?.organizationUnitId).toBe(s.root.id);
      expect(lifespanOf(draft?.resolvedBody)).toBe('2027');
    });

    it('covers the anchor month when the template says a month', async () => {
      const s = await setup({ contractBody: bodyWithLifespan('10/2026') });
      const draft = await draftFor(s, new Date('2026-12-15T12:00:00.000Z'));

      expect(draft?.periodStart).toEqual(startOfAppDay(2026, 11, 1));
      expect(draft?.periodEnd).toEqual(startOfAppDay(2027, 0, 1));
      expect(lifespanOf(draft?.resolvedBody)).toBe('12/2026');
    });

    it('keeps a template range that contains the anchor', async () => {
      const s = await setup({
        contractBody: bodyWithLifespan('05.10.2026–11.10.2026'),
      });
      const draft = await draftFor(s, new Date('2026-10-07T10:00:00.000Z'));

      expect(draft?.periodStart).toEqual(startOfAppDay(2026, 9, 5));
      expect(draft?.periodEnd).toEqual(startOfAppDay(2026, 9, 12));
      expect(lifespanOf(draft?.resolvedBody)).toBe('05.10.2026–11.10.2026');
    });

    it('falls back to the anchor year when the range does not contain the anchor', async () => {
      const s = await setup({
        contractBody: bodyWithLifespan('05.10.2026–11.10.2026'),
      });
      const draft = await draftFor(s, new Date('2026-10-20T10:00:00.000Z'));

      const year = billingYearBounds(2026);
      expect(draft?.periodStart).toEqual(year.start);
      expect(draft?.periodEnd).toEqual(year.end);
      expect(lifespanOf(draft?.resolvedBody)).toBe('2026');
    });

    it('covers the anchor year when the template has no lifespan field at all', async () => {
      const s = await setup();
      const draft = await draftFor(s, new Date('2026-06-15T10:00:00.000Z'));

      const year = billingYearBounds(2026);
      expect(draft?.periodStart).toEqual(year.start);
      expect(draft?.periodEnd).toEqual(year.end);
      expect(lifespanOf(draft?.resolvedBody)).toBeUndefined();
    });

    it('covers the anchor year when the lifespan is empty or unreadable', async () => {
      for (const value of ['', 'garbage']) {
        const s = await setup({ contractBody: bodyWithLifespan(value) });
        const draft = await draftFor(s, new Date('2026-06-15T10:00:00.000Z'));
        expect(draft?.periodStart).toEqual(billingYearBounds(2026).start);
        expect(lifespanOf(draft?.resolvedBody)).toBe('2026');
      }
    });

    it('uses the Berlin date for an entry just after midnight on 1 January', async () => {
      const s = await setup();
      // 00:30 Berlin on 01.01.2027 is still 31.12.2026 in UTC.
      const draft = await draftFor(s, new Date('2026-12-31T23:30:00.000Z'));

      expect(draft?.periodStart).toEqual(billingYearBounds(2027).start);
      expect(draft?.periodEnd).toEqual(billingYearBounds(2027).end);
    });

    it('resolves a missing unit to the organisation root unit', async () => {
      const s = await setup();
      const draft = await service.ensureDraftContract(
        s.organization.id,
        {
          organizationUnitId: null,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          anchorDate: new Date('2026-06-15T10:00:00.000Z'),
        },
        s.signer.id,
      );
      expect(draft?.organizationUnitId).toBe(s.root.id);
    });

    it('does nothing when an awaiting-signature contract covers the entry', async () => {
      const s = await setup();
      await insertContract({
        templateId: s.template.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        organizationUnitId: s.root.id,
        status: ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        ...OCTOBER,
      });

      expect(
        await draftFor(s, new Date('2026-10-15T10:00:00.000Z')),
      ).toBeUndefined();
    });

    it('queues a draft when the only covering contract was declined', async () => {
      const s = await setup();
      await insertContract({
        templateId: s.template.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        organizationUnitId: s.root.id,
        status: ContractStatus.DECLINED,
        ...OCTOBER,
      });

      const draft = await draftFor(s, new Date('2026-10-15T10:00:00.000Z'));
      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('queues a draft for an entry a week contract does not cover', async () => {
      const s = await setup();
      await insertContract({
        templateId: s.template.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        organizationUnitId: s.root.id,
        status: ContractStatus.ACTIVE,
        periodStart: startOfAppDay(2026, 9, 5),
        periodEnd: startOfAppDay(2026, 9, 12),
      });

      expect(
        await draftFor(s, new Date('2026-10-07T10:00:00.000Z')),
      ).toBeUndefined();
      const draft = await draftFor(s, new Date('2026-10-20T10:00:00.000Z'));
      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('does not queue a second draft for an entry inside an existing draft', async () => {
      const s = await setup();
      const first = await draftFor(s, new Date('2026-10-07T10:00:00.000Z'));
      expect(first?.contractStatus).toBe(ContractStatus.DRAFT);

      expect(
        await draftFor(s, new Date('2026-11-20T10:00:00.000Z')),
      ).toBeUndefined();

      const rows = await db.query.contracts.findMany({
        where: { volunteerId: s.volunteer.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('does not let a contract of another unit count as cover', async () => {
      const s = await setup();
      const sibling = await createUnit(db, {
        organizationId: s.organization.id,
        typeId: s.type.id,
        name: 'sibling',
        parentId: s.root.id,
      });
      await insertContract({
        templateId: s.template.id,
        volunteerId: s.volunteer.id,
        reimbursementTypeId: s.reimbursementType.id,
        organizationUnitId: sibling.id,
        status: ContractStatus.ACTIVE,
        ...OCTOBER,
      });

      const draft = await draftFor(s, new Date('2026-10-15T10:00:00.000Z'));
      expect(draft?.organizationUnitId).toBe(s.root.id);
    });

    it('queues one draft when several entries close at the same moment', async () => {
      const s = await setup();
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          draftFor(
            s,
            new Date(`2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`),
          ),
        ),
      );

      expect(results.filter((r) => r !== undefined)).toHaveLength(1);
      const rows = await db.query.contracts.findMany({
        where: { volunteerId: s.volunteer.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('waits while another check for the same volunteer, type and unit holds the lock', async () => {
      const s = await setup();
      // The same key ensureDraftContract serialises on; holding it here stands
      // in for a concurrent entry that is mid-way through its own check.
      const lockKey = [s.volunteer.id, s.reimbursementType.id, s.root.id].join(
        ':',
      );
      let settled = false;
      let pending: ReturnType<typeof draftFor> | undefined;

      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
        );
        pending = draftFor(s, new Date('2026-10-07T10:00:00.000Z')).then(
          (draft) => {
            settled = true;
            return draft;
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(settled).toBe(false);
      });

      const draft = await pending;
      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('reports a missing template as a not-found error', async () => {
      const { organization, type } = await createOrganizationWithType(
        db,
        `No Template Org ${crypto.randomUUID()}`,
      );
      const root = await createUnit(db, {
        organizationId: organization.id,
        typeId: type.id,
        name: 'root',
      });
      const reimbursementType = await createReimbursementType(db);
      const volunteer = await createUser(db);

      await expect(
        service.ensureDraftContract(
          organization.id,
          {
            organizationUnitId: root.id,
            volunteerId: volunteer.id,
            reimbursementTypeId: reimbursementType.id,
            anchorDate: new Date('2026-10-15T10:00:00.000Z'),
          },
          volunteer.id,
        ),
      ).rejects.toBeInstanceOf(NotFoundGraphQLError);
    });
  });

  describe('createContract draft supersede', () => {
    const queueDraft = (
      s: Awaited<ReturnType<typeof setup>>,
      anchorDate: Date,
    ) =>
      service.ensureDraftContract(
        s.organization.id,
        {
          organizationUnitId: s.root.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          anchorDate,
        },
        s.signer.id,
      );

    const create = (
      s: Awaited<ReturnType<typeof setup>>,
      period: { start: Date; end: Date },
      extra: { sourceDraftId?: string | null } = {},
    ) =>
      service.createContract(
        s.organization.id,
        {
          organizationUnitId: s.root.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          periodStart: period.start,
          periodEnd: period.end,
          sourceDraftId: extra.sourceDraftId,
        },
        s.signer.id,
      );

    const draftIds = async (s: Awaited<ReturnType<typeof setup>>) =>
      (
        await db.query.contracts.findMany({
          where: {
            volunteerId: s.volunteer.id,
            contractStatus: ContractStatus.DRAFT,
          },
        })
      ).map((c) => c.id);

    const october = () =>
      billingMonthBoundsOf(new Date('2026-10-20T10:00:00.000Z'));

    it('keeps a month draft when a week contract is created inside it', async () => {
      const s = await setup({ contractBody: bodyWithLifespan('10/2026') });
      const draft = await queueDraft(s, new Date('2026-10-20T10:00:00.000Z'));

      await create(s, {
        start: startOfAppDay(2026, 9, 5),
        end: startOfAppDay(2026, 9, 12),
      });

      expect(await draftIds(s)).toEqual([draft?.id]);
    });

    it('supersedes a month draft when a month contract covers it', async () => {
      const s = await setup({ contractBody: bodyWithLifespan('10/2026') });
      await queueDraft(s, new Date('2026-10-20T10:00:00.000Z'));

      const contract = await create(s, october());

      expect(await draftIds(s)).toEqual([]);
      const changes = await db.query.contractStatusChanges.findMany({
        where: { contractId: contract.id },
      });
      expect(changes.map((c) => c.type)).toContain(
        DocumentStatusChange.DRAFT_SUPERSEDED,
      );
    });

    it('supersedes a year draft when a year contract covers it', async () => {
      const s = await setup();
      await queueDraft(s, new Date('2026-06-15T10:00:00.000Z'));

      await create(s, billingYearBounds(2026));

      expect(await draftIds(s)).toEqual([]);
    });

    it('keeps a year draft that is only partly covered by a month contract', async () => {
      const s = await setup();
      const draft = await queueDraft(s, new Date('2026-06-15T10:00:00.000Z'));

      await create(s, october());

      expect(await draftIds(s)).toEqual([draft?.id]);
    });

    it('consumes the source draft even when the new contract does not contain it', async () => {
      const s = await setup();
      const draft = await queueDraft(s, new Date('2026-06-15T10:00:00.000Z'));

      await create(s, october(), { sourceDraftId: draft?.id });

      expect(await draftIds(s)).toEqual([]);
    });

    it('ignores a source draft id that matches nothing', async () => {
      const s = await setup();
      const contract = await create(s, october(), {
        sourceDraftId: crypto.randomUUID(),
      });
      expect(contract.contractStatus).toBe(
        ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
      );
    });

    it("never deletes another organization's draft, not even by source draft id", async () => {
      const a = await setup();
      const b = await setup();
      const draftInB = await service.ensureDraftContract(
        b.organization.id,
        {
          organizationUnitId: b.root.id,
          volunteerId: a.volunteer.id,
          reimbursementTypeId: a.reimbursementType.id,
          anchorDate: new Date('2026-06-15T10:00:00.000Z'),
        },
        b.signer.id,
      );
      expect(draftInB?.contractStatus).toBe(ContractStatus.DRAFT);

      await create(a, billingYearBounds(2026), { sourceDraftId: draftInB?.id });

      const kept = await db.query.contracts.findFirst({
        where: { id: draftInB?.id },
      });
      expect(kept?.contractStatus).toBe(ContractStatus.DRAFT);
    });

    it('never deletes a draft of another unit of the same organization', async () => {
      const s = await setup();
      const sibling = await createUnit(db, {
        organizationId: s.organization.id,
        typeId: s.type.id,
        name: 'sibling',
        parentId: s.root.id,
      });
      const draftInSibling = await service.ensureDraftContract(
        s.organization.id,
        {
          organizationUnitId: sibling.id,
          volunteerId: s.volunteer.id,
          reimbursementTypeId: s.reimbursementType.id,
          anchorDate: new Date('2026-06-15T10:00:00.000Z'),
        },
        s.signer.id,
      );

      await create(s, billingYearBounds(2026));

      expect(await draftIds(s)).toEqual([draftInSibling?.id]);
    });
  });

  describe('findContractsForOrganization', () => {
    it('only returns contracts scoped to the given organization', async () => {
      const first = await setup();
      const second = await setup();

      const firstContract = await service.createContract(
        first.organization.id,
        {
          organizationUnitId: null,
          volunteerId: first.volunteer.id,
          reimbursementTypeId: first.reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        first.signer.id,
      );
      await service.createContract(
        second.organization.id,
        {
          organizationUnitId: null,
          volunteerId: second.volunteer.id,
          reimbursementTypeId: second.reimbursementType.id,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        second.signer.id,
      );

      const results = await service.findContractsForOrganization(
        first.organization.id,
      );
      expect(results.map((c) => c.id)).toEqual([firstContract.id]);
    });

    it('scopes contracts to the requested organization unit', async () => {
      const { organization, root, reimbursementType, volunteer, signer } =
        await setup();
      const sibling = await createUnit(db, {
        organizationId: organization.id,
        typeId: root.typeId,
        name: 'sibling',
        parentId: root.id,
      });

      const inRoot = await service.createContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-12-31'),
        },
        signer.id,
      );
      const inSibling = await service.createContract(
        organization.id,
        {
          organizationUnitId: sibling.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-12-31'),
        },
        signer.id,
      );

      const rootOnly = await service.findContractsForOrganization(
        organization.id,
        { organizationUnitId: root.id },
      );
      const ids = rootOnly.map((c) => c.id);
      expect(ids).toContain(inRoot.id);
      expect(ids).not.toContain(inSibling.id);
    });

    it('excludes contracts whose period does not overlap the requested range', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const secondVolunteer = await createUser(db);

      const inRange = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-03-01'),
          periodEnd: new Date('2026-03-31'),
        },
        signer.id,
      );
      const outOfRange = await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: secondVolunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2026-06-30'),
        },
        signer.id,
      );

      const results = await service.findContractsForOrganization(
        organization.id,
        {
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-04-01'),
        },
      );

      const ids = results.map((c) => c.id);
      expect(ids).toContain(inRange.id);
      expect(ids).not.toContain(outOfRange.id);
    });

    it('excludes auto-queued DRAFT contracts when issuedOnly is set', async () => {
      const { organization, root, reimbursementType, volunteer, signer } =
        await setup();

      const issued = await service.createContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-12-31'),
        },
        signer.id,
      );
      const draft = await service.createDraftContract(
        organization.id,
        {
          organizationUnitId: root.id,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-12-31'),
        },
        signer.id,
      );

      const all = await service.findContractsForOrganization(organization.id);
      expect(all.map((c) => c.id).sort()).toEqual([issued.id, draft.id].sort());

      const onlyIssued = await service.findContractsForOrganization(
        organization.id,
        { issuedOnly: true },
      );
      expect(onlyIssued.map((c) => c.id)).toEqual([issued.id]);
    });
  });
});

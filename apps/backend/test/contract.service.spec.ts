import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  SigneeType,
} from '../src/accounting/enums';
import { ContractService } from '../src/accounting/services/contract.service';
import { DocumentNotificationService } from '../src/accounting/services/document-notification.service';
import { DocumentProfileRequirementService } from '../src/accounting/services/document-profile-requirement.service';
import { DocumentRenderingService } from '../src/accounting/services/document-rendering.service';
import { DocumentSigningService } from '../src/accounting/services/document-signing.service';
import { DocumentTemplateService } from '../src/accounting/services/document-template.service';
import { AuthService } from '../src/auth/auth.service';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import {
  ConflictGraphQLError,
  ForbiddenGraphQLError,
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
  const setup = async () => {
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
    });
    const volunteer = await createUser(db);

    return {
      organization,
      root,
      reimbursementType,
      template,
      signer,
      volunteer,
    };
  };

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
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: null,
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
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
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
    // from queuing one for a later, uncovered month.
    it('queues a draft for a month no existing contract covers', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      await service.createContract(
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

      const draft = await service.ensureDraftContract(
        organization.id,
        {
          organizationUnitId: null,
          volunteerId: volunteer.id,
          reimbursementTypeId: reimbursementType.id,
          anchorDate: new Date('2026-09-15T12:00:00.000Z'),
        },
        signer.id,
      );

      expect(draft?.contractStatus).toBe(ContractStatus.DRAFT);
      // VOLI-1370: the draft is scoped to the uncovered month, not the year.
      expect(draft?.periodStart).toEqual(new Date('2026-08-31T22:00:00.000Z'));
      expect(draft?.periodEnd).toEqual(new Date('2026-09-30T22:00:00.000Z'));
    });

    it('does not queue a draft when an existing contract covers the anchor date', async () => {
      const { organization, reimbursementType, volunteer, signer } =
        await setup();
      await service.createContract(
        organization.id,
        {
          organizationUnitId: null,
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
          organizationUnitId: null,
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

import 'reflect-metadata';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DocumentKind, SigneeType } from '../src/accounting/enums';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import {
  createDocumentTemplate,
  createReimbursementType,
} from './factories/accounting.factory';
import {
  addMembership,
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import {
  assignRoleToMembership,
  grantPermissionToRole,
} from './factories/role.factory';
import { createUser } from './factories/user.factory';
import { applyBunAuthMocks, setAuthMockUserId } from './helpers/auth-mocks';
import { graphqlRequest } from './helpers/graphql-request';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(30_000);

const ACTIVE_TEMPLATE = `
  query ActiveTemplate($typeId: ID!, $kind: DocumentKind!, $unitId: ID) {
    activeDocumentTemplate(
      reimbursementTypeId: $typeId
      kind: $kind
      organizationUnitId: $unitId
    ) {
      id
      organizationUnit {
        id
        name
      }
    }
  }
`;

const SETUP_STATUS = `
  query SetupStatus {
    accountingSetupStatus {
      slots {
        reimbursementTypeId
        hasContractTemplate
        hasInvoiceTemplate
        ready
      }
      canCreateDocuments
    }
  }
`;

const SIGNEES = [{ order: 1, signeeType: SigneeType.VOLUNTEER }];

interface ActiveTemplateData {
  activeDocumentTemplate: {
    id: string;
    organizationUnit: { id: string; name: string } | null;
  };
}

interface SetupStatusData {
  accountingSetupStatus: {
    slots: {
      reimbursementTypeId: string;
      hasContractTemplate: boolean;
      hasInvoiceTemplate: boolean;
      ready: boolean;
    }[];
    canCreateDocuments: boolean;
  };
}

describe('document templates resolve through the unit ancestor chain', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;

  let organizationId: string;
  let typeId: string;
  let rootId: string;
  let childId: string;
  let grandchildId: string;
  let siblingId: string;
  let ownerId: string;

  const asHeader = (unitId: string) => ({ 'x-organization-unit-id': unitId });

  const seed = (
    organizationUnitId: string | null,
    kind: DocumentKind = DocumentKind.CONTRACT,
  ) =>
    createDocumentTemplate(db, {
      organizationId,
      organizationUnitId,
      reimbursementTypeId: typeId,
      kind,
      signees: SIGNEES,
    });

  const resolveFor = (
    unitId: string,
    kind: DocumentKind = DocumentKind.CONTRACT,
  ) =>
    graphqlRequest<ActiveTemplateData>(app, {
      query: ACTIVE_TEMPLATE,
      variables: { typeId, kind, unitId },
      headers: asHeader(unitId),
    });

  const setupFor = async (unitId: string) => {
    const response = await graphqlRequest<SetupStatusData>(app, {
      query: SETUP_STATUS,
      headers: asHeader(unitId),
    });
    expect(response.errors).toBeUndefined();
    const slot = response.data?.accountingSetupStatus.slots.find(
      (candidate) => candidate.reimbursementTypeId === typeId,
    );
    return { slot, status: response.data?.accountingSetupStatus };
  };

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;

    const { organization, type } = await createOrganizationWithType(
      db,
      `Template Inheritance Org ${crypto.randomUUID()}`,
    );
    organizationId = organization.id;
    await db
      .update(schema.organizations)
      .set({
        accountingEnabled: true,
        street: 'Musterstr. 1',
        zipCode: '20095',
        city: 'Hamburg',
      })
      .where(eq(schema.organizations.id, organization.id));

    const root = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'root',
    });
    const child = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'child',
      parentId: root.id,
    });
    const grandchild = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'grandchild',
      parentId: child.id,
    });
    const sibling = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'sibling',
      parentId: root.id,
    });
    rootId = root.id;
    childId = child.id;
    grandchildId = grandchild.id;
    siblingId = sibling.id;

    const [role] = await db
      .insert(schema.roles)
      .values({
        name: `Owner ${crypto.randomUUID()}`,
        isInternal: true,
        organizationId,
      })
      .returning();
    for (const permission of await db.query.permissions.findMany()) {
      await grantPermissionToRole(db, {
        roleId: role.id,
        permissionId: permission.id,
      });
    }
    const owner = await createUser(db);
    ownerId = owner.id;
    const membership = await addMembership(db, owner.id, root.id);
    await assignRoleToMembership(db, {
      membershipId: membership.id,
      roleId: role.id,
    });

    typeId = (await createReimbursementType(db)).id;
  });

  afterEach(async () => {
    setAuthMockUserId(testUserId);
    await db
      .delete(schema.documentTemplates)
      .where(eq(schema.documentTemplates.organizationId, organizationId));
  });

  const asOwner = () => setAuthMockUserId(ownerId);

  it('uses the root template for a child and a grandchild', async () => {
    const rootTemplate = await seed(rootId);
    asOwner();

    for (const unitId of [childId, grandchildId]) {
      const response = await resolveFor(unitId);
      expect(response.errors).toBeUndefined();
      expect(response.data?.activeDocumentTemplate.id).toBe(rootTemplate.id);
      expect(response.data?.activeDocumentTemplate.organizationUnit).toEqual({
        id: rootId,
        name: 'root',
      });
    }
  });

  it('uses the nearest ancestor override for the grandchild', async () => {
    await seed(rootId);
    const childTemplate = await seed(childId);
    asOwner();

    const response = await resolveFor(grandchildId);

    expect(response.errors).toBeUndefined();
    expect(response.data?.activeDocumentTemplate.id).toBe(childTemplate.id);
    expect(response.data?.activeDocumentTemplate.organizationUnit?.id).toBe(
      childId,
    );
  });

  it('prefers the unit own template over every ancestor', async () => {
    await seed(rootId);
    await seed(childId);
    const ownTemplate = await seed(grandchildId);
    asOwner();

    const response = await resolveFor(grandchildId);

    expect(response.data?.activeDocumentTemplate.id).toBe(ownTemplate.id);
  });

  it('does not leak a sibling override to other units', async () => {
    const rootTemplate = await seed(rootId);
    await seed(childId);
    asOwner();

    const response = await resolveFor(siblingId);

    expect(response.errors).toBeUndefined();
    expect(response.data?.activeDocumentTemplate.id).toBe(rootTemplate.id);
  });

  it('falls back to the org-wide template when no unit on the chain has one', async () => {
    const orgWide = await seed(null);
    await seed(siblingId);
    asOwner();

    const response = await resolveFor(grandchildId);

    expect(response.errors).toBeUndefined();
    expect(response.data?.activeDocumentTemplate.id).toBe(orgWide.id);
    expect(response.data?.activeDocumentTemplate.organizationUnit).toBeNull();
  });

  it('prefers a unit template over the org-wide one', async () => {
    await seed(null);
    const rootTemplate = await seed(rootId);
    asOwner();

    const response = await resolveFor(childId);

    expect(response.data?.activeDocumentTemplate.id).toBe(rootTemplate.id);
  });

  it('skips deleted templates on the chain', async () => {
    const rootTemplate = await seed(rootId);
    const childTemplate = await seed(childId);
    await db
      .update(schema.documentTemplates)
      .set({ isDeleted: true })
      .where(eq(schema.documentTemplates.id, childTemplate.id));
    asOwner();

    const response = await resolveFor(grandchildId);

    expect(response.errors).toBeUndefined();
    expect(response.data?.activeDocumentTemplate.id).toBe(rootTemplate.id);
  });

  it('keeps kinds independent', async () => {
    const invoiceAtChild = await seed(childId, DocumentKind.INVOICE);
    const contractAtRoot = await seed(rootId, DocumentKind.CONTRACT);
    asOwner();

    const invoice = await resolveFor(grandchildId, DocumentKind.INVOICE);
    const contract = await resolveFor(grandchildId, DocumentKind.CONTRACT);

    expect(invoice.data?.activeDocumentTemplate.id).toBe(invoiceAtChild.id);
    expect(contract.data?.activeDocumentTemplate.id).toBe(contractAtRoot.id);
  });

  it('reports not found when nothing on the chain or org-wide exists', async () => {
    await seed(siblingId);
    asOwner();

    const response = await resolveFor(grandchildId);

    expect(response.errors?.[0]?.message).toContain(
      'No contract template configured',
    );
  });

  describe('accountingSetupStatus', () => {
    it('reports a child as set up when only the root has both templates', async () => {
      await seed(rootId, DocumentKind.CONTRACT);
      await seed(rootId, DocumentKind.INVOICE);
      asOwner();

      for (const unitId of [childId, grandchildId, siblingId]) {
        const { slot, status } = await setupFor(unitId);
        expect(slot).toMatchObject({
          hasContractTemplate: true,
          hasInvoiceTemplate: true,
          ready: true,
        });
        expect(status?.canCreateDocuments).toBe(true);
      }
    });

    it('mixes inherited and own templates across the two kinds', async () => {
      await seed(rootId, DocumentKind.CONTRACT);
      await seed(grandchildId, DocumentKind.INVOICE);
      asOwner();

      expect((await setupFor(grandchildId)).slot?.ready).toBe(true);
      const child = (await setupFor(childId)).slot;
      expect(child?.hasContractTemplate).toBe(true);
      expect(child?.hasInvoiceTemplate).toBe(false);
      expect(child?.ready).toBe(false);
    });

    it('ignores deleted ancestor templates', async () => {
      const contract = await seed(rootId, DocumentKind.CONTRACT);
      await seed(rootId, DocumentKind.INVOICE);
      await db
        .update(schema.documentTemplates)
        .set({ isDeleted: true })
        .where(eq(schema.documentTemplates.id, contract.id));
      asOwner();

      const { slot } = await setupFor(childId);

      expect(slot?.hasContractTemplate).toBe(false);
      expect(slot?.ready).toBe(false);
    });
  });
});

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
  createReimbursementRate,
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

const SET_RATE = `
  mutation SetRate($typeId: ID!, $cents: Int!, $unitId: ID) {
    setReimbursementRate(
      reimbursementTypeId: $typeId
      hourlyRateCents: $cents
      organizationUnitId: $unitId
    ) {
      id
      hourlyRateCents
    }
  }
`;

const CREATE_TEMPLATE = `
  mutation CreateTemplate($input: CreateDocumentTemplateInput!) {
    createDocumentTemplate(input: $input) {
      id
      organizationUnit {
        id
      }
    }
  }
`;

const UPDATE_TEMPLATE = `
  mutation UpdateTemplate($id: ID!, $input: UpdateDocumentTemplateInput!) {
    updateDocumentTemplate(id: $id, input: $input) {
      id
      invoiceNumberFormat
    }
  }
`;

const DELETE_TEMPLATE = `
  mutation DeleteTemplate($id: ID!) {
    deleteDocumentTemplate(id: $id)
  }
`;

const ACTIVE_TEMPLATE = `
  query ActiveTemplate($typeId: ID!, $kind: DocumentKind!, $unitId: ID) {
    activeDocumentTemplate(
      reimbursementTypeId: $typeId
      kind: $kind
      organizationUnitId: $unitId
    ) {
      id
    }
  }
`;

const LIST_TEMPLATES = `
  query ListTemplates {
    documentTemplates {
      id
    }
  }
`;

const GET_TEMPLATE = `
  query GetTemplate($id: ID!) {
    documentTemplate(id: $id) {
      id
    }
  }
`;

const SIGNEES = [{ order: 1, signeeType: SigneeType.VOLUNTEER }];
const BODY = { header: {}, blocks: [], footer: {} };

describe('accounting writes are scoped to the header unit tree', () => {
  let app: INestApplication;
  let db: Database;
  let testUserId: string;

  let typeId: string;
  let rootId: string;
  let unitAId: string;
  let unitBId: string;
  let unitTypeId: string;
  let ownerOnAId: string;
  let ownerOnRootId: string;

  const asHeader = (unitId: string) => ({ 'x-organization-unit-id': unitId });

  const createOwnerRole = async (organizationId: string) => {
    const [role] = await db
      .insert(schema.roles)
      .values({
        name: `Owner ${crypto.randomUUID()}`,
        isInternal: true,
        organizationId,
      })
      .returning();
    const permissions = await db.query.permissions.findMany();
    for (const permission of permissions) {
      await grantPermissionToRole(db, {
        roleId: role.id,
        permissionId: permission.id,
      });
    }
    return role;
  };

  const rateRows = (organizationUnitId: string | null) =>
    db.query.reimbursementRates.findMany({
      where: {
        organizationId,
        reimbursementTypeId: typeId,
        organizationUnitId: organizationUnitId ?? { isNull: true },
      },
    });

  const templateRow = (id: string) =>
    db.query.documentTemplates.findFirst({ where: { id } });

  let organizationId: string;

  const resetAccountingRows = async () => {
    await db
      .delete(schema.reimbursementRates)
      .where(eq(schema.reimbursementRates.organizationId, organizationId));
    await db
      .delete(schema.documentTemplates)
      .where(eq(schema.documentTemplates.organizationId, organizationId));
  };

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    app = context.app;
    db = context.db;
    testUserId = context.testUserId;

    const { organization, type } = await createOrganizationWithType(
      db,
      `Write Scope Org ${crypto.randomUUID()}`,
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
    const unitA = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'unit a',
      parentId: root.id,
    });
    const unitB = await createUnit(db, {
      organizationId,
      typeId: type.id,
      name: 'unit b',
      parentId: root.id,
    });
    unitTypeId = type.id;
    rootId = root.id;
    unitAId = unitA.id;
    unitBId = unitB.id;

    const ownerRole = await createOwnerRole(organizationId);
    const ownerOnA = await createUser(db);
    const ownerOnRoot = await createUser(db);
    ownerOnAId = ownerOnA.id;
    ownerOnRootId = ownerOnRoot.id;
    const membershipA = await addMembership(db, ownerOnA.id, unitA.id);
    await assignRoleToMembership(db, {
      membershipId: membershipA.id,
      roleId: ownerRole.id,
    });
    const membershipRoot = await addMembership(db, ownerOnRoot.id, root.id);
    await assignRoleToMembership(db, {
      membershipId: membershipRoot.id,
      roleId: ownerRole.id,
    });

    typeId = (await createReimbursementType(db)).id;
  });

  afterEach(async () => {
    setAuthMockUserId(testUserId);
    await resetAccountingRows();
  });

  describe('setReimbursementRate', () => {
    it('rejects an org-wide rate from a sub-unit and leaves the row alone', async () => {
      await createReimbursementRate(db, {
        organizationId,
        reimbursementTypeId: typeId,
        hourlyRateCents: 1_000,
      });
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: SET_RATE,
        variables: { typeId, cents: 9_999 },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
      const rows = await rateRows(null);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.hourlyRateCents).toBe(1_000);
    });

    it('rejects an explicit null unit id from a sub-unit', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: SET_RATE,
        variables: { typeId, cents: 9_999, unitId: null },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
      expect(await rateRows(null)).toHaveLength(0);
    });

    it('allows a rate for the caller own unit', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest<{
        setReimbursementRate: { hourlyRateCents: number };
      }>(app, {
        query: SET_RATE,
        variables: { typeId, cents: 1_234, unitId: unitAId },
        headers: asHeader(unitAId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.setReimbursementRate.hourlyRateCents).toBe(1_234);
      expect(await rateRows(unitAId)).toHaveLength(1);
    });

    it('rejects a sibling unit rate', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: SET_RATE,
        variables: { typeId, cents: 1_234, unitId: unitBId },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
      expect(await rateRows(unitBId)).toHaveLength(0);
    });

    it('allows an org-wide rate from the top unit', async () => {
      setAuthMockUserId(ownerOnRootId);

      const response = await graphqlRequest<{
        setReimbursementRate: { hourlyRateCents: number };
      }>(app, {
        query: SET_RATE,
        variables: { typeId, cents: 2_222 },
        headers: asHeader(rootId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.setReimbursementRate.hourlyRateCents).toBe(2_222);
      const rows = await rateRows(null);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.hourlyRateCents).toBe(2_222);
    });
  });

  describe('createDocumentTemplate', () => {
    const input = (organizationUnitId?: string) => ({
      organizationUnitId,
      reimbursementTypeId: typeId,
      kind: DocumentKind.CONTRACT,
      body: BODY,
      signees: SIGNEES,
    });

    it('rejects a template for a sibling unit', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: CREATE_TEMPLATE,
        variables: { input: input(unitBId) },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
      const rows = await db.query.documentTemplates.findMany({
        where: { organizationId },
      });
      expect(rows).toHaveLength(0);
    });

    it('rejects an org-wide template from a sub-unit', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: CREATE_TEMPLATE,
        variables: { input: input() },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
      const rows = await db.query.documentTemplates.findMany({
        where: { organizationId },
      });
      expect(rows).toHaveLength(0);
    });

    it('allows a template for the caller own unit', async () => {
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest<{
        createDocumentTemplate: { organizationUnit: { id: string } };
      }>(app, {
        query: CREATE_TEMPLATE,
        variables: { input: input(unitAId) },
        headers: asHeader(unitAId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.createDocumentTemplate.organizationUnit?.id).toBe(
        unitAId,
      );
    });

    it('allows an org-wide template from the top unit', async () => {
      setAuthMockUserId(ownerOnRootId);

      const response = await graphqlRequest<{
        createDocumentTemplate: { organizationUnit: { id: string } | null };
      }>(app, {
        query: CREATE_TEMPLATE,
        variables: { input: input() },
        headers: asHeader(rootId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.createDocumentTemplate.organizationUnit).toBeNull();
    });
  });

  describe('updateDocumentTemplate and deleteDocumentTemplate', () => {
    const seedTemplate = (organizationUnitId: string | null) =>
      createDocumentTemplate(db, {
        organizationId,
        organizationUnitId,
        reimbursementTypeId: typeId,
        kind: DocumentKind.CONTRACT,
        signees: SIGNEES,
      });

    const update = (id: string, header: string) =>
      graphqlRequest<{ updateDocumentTemplate: { id: string } }>(app, {
        query: UPDATE_TEMPLATE,
        variables: { id, input: { invoiceNumberFormat: 'changed' } },
        headers: asHeader(header),
      });

    const remove = (id: string, header: string) =>
      graphqlRequest<{ deleteDocumentTemplate: boolean }>(app, {
        query: DELETE_TEMPLATE,
        variables: { id },
        headers: asHeader(header),
      });

    it('rejects update and delete of the org-wide template from a sub-unit', async () => {
      const template = await seedTemplate(null);
      setAuthMockUserId(ownerOnAId);

      const updated = await update(template.id, unitAId);
      const deleted = await remove(template.id, unitAId);

      expect(updated.errors?.[0]?.message).toBe('Document template not found');
      expect(deleted.errors?.[0]?.message).toBe('Document template not found');
      const row = await templateRow(template.id);
      expect(row?.isDeleted).toBe(false);
      expect(row?.invoiceNumberFormat).toBeNull();
    });

    it('rejects update and delete of a sibling unit template', async () => {
      const template = await seedTemplate(unitBId);
      setAuthMockUserId(ownerOnAId);

      const updated = await update(template.id, unitAId);
      const deleted = await remove(template.id, unitAId);

      expect(updated.errors?.[0]?.message).toBe('Document template not found');
      expect(deleted.errors?.[0]?.message).toBe('Document template not found');
      const row = await templateRow(template.id);
      expect(row?.isDeleted).toBe(false);
      expect(row?.invoiceNumberFormat).toBeNull();
    });

    it('rejects update and delete of an ancestor unit template and leaves it unchanged', async () => {
      const template = await seedTemplate(rootId);
      setAuthMockUserId(ownerOnAId);

      const updated = await update(template.id, unitAId);
      const deleted = await remove(template.id, unitAId);

      expect(updated.errors?.[0]?.message).toBe('Document template not found');
      expect(deleted.errors?.[0]?.message).toBe('Document template not found');
      const row = await templateRow(template.id);
      expect(row?.isDeleted).toBe(false);
      expect(row?.invoiceNumberFormat).toBeNull();
    });

    it('returns the same error for a sibling template id and an unknown id', async () => {
      const sibling = await seedTemplate(unitBId);
      const unknownId = crypto.randomUUID();
      setAuthMockUserId(ownerOnAId);

      const siblingUpdate = await update(sibling.id, unitAId);
      const unknownUpdate = await update(unknownId, unitAId);
      const siblingDelete = await remove(sibling.id, unitAId);
      const unknownDelete = await remove(unknownId, unitAId);
      const siblingGet = await graphqlRequest(app, {
        query: GET_TEMPLATE,
        variables: { id: sibling.id },
        headers: asHeader(unitAId),
      });
      const unknownGet = await graphqlRequest(app, {
        query: GET_TEMPLATE,
        variables: { id: unknownId },
        headers: asHeader(unitAId),
      });

      expect(siblingUpdate.errors?.[0]?.message).toBe(
        unknownUpdate.errors?.[0]?.message,
      );
      expect(siblingDelete.errors?.[0]?.message).toBe(
        unknownDelete.errors?.[0]?.message,
      );
      expect(siblingGet.errors?.[0]?.message).toBe(
        unknownGet.errors?.[0]?.message,
      );
      expect(unknownGet.errors?.[0]?.message).toBe(
        'Document template not found',
      );
    });

    it('allows update and delete of the caller own unit template', async () => {
      const template = await seedTemplate(unitAId);
      setAuthMockUserId(ownerOnAId);

      const updated = await update(template.id, unitAId);
      expect(updated.errors).toBeUndefined();
      expect((await templateRow(template.id))?.invoiceNumberFormat).toBe(
        'changed',
      );

      const deleted = await remove(template.id, unitAId);
      expect(deleted.errors).toBeUndefined();
      expect((await templateRow(template.id))?.isDeleted).toBe(true);
    });

    it('allows the top unit to update and delete the org-wide template', async () => {
      const template = await seedTemplate(null);
      setAuthMockUserId(ownerOnRootId);

      const updated = await update(template.id, rootId);
      expect(updated.errors).toBeUndefined();
      expect((await templateRow(template.id))?.invoiceNumberFormat).toBe(
        'changed',
      );

      const deleted = await remove(template.id, rootId);
      expect(deleted.errors).toBeUndefined();
      expect((await templateRow(template.id))?.isDeleted).toBe(true);
    });
  });

  describe('empty-string unit ids', () => {
    it('rejects an empty organizationUnitId on setReimbursementRate', async () => {
      setAuthMockUserId(ownerOnRootId);

      const response = await graphqlRequest(app, {
        query: SET_RATE,
        variables: { typeId, cents: 1_000, unitId: '' },
        headers: asHeader(rootId),
      });

      expect(response.errors?.[0]?.message).toBe(
        'organizationUnitId must not be empty',
      );
      expect(await rateRows(null)).toHaveLength(0);
    });

    it('rejects an empty organizationUnitId on activeDocumentTemplate', async () => {
      setAuthMockUserId(ownerOnRootId);

      const response = await graphqlRequest(app, {
        query: ACTIVE_TEMPLATE,
        variables: { typeId, kind: DocumentKind.CONTRACT, unitId: '' },
        headers: asHeader(rootId),
      });

      expect(response.errors?.[0]?.message).toBe(
        'organizationUnitId must not be empty',
      );
    });
  });

  describe('activeDocumentTemplate', () => {
    it('rejects a sibling unit id', async () => {
      await createDocumentTemplate(db, {
        organizationId,
        organizationUnitId: unitBId,
        reimbursementTypeId: typeId,
        kind: DocumentKind.CONTRACT,
        signees: SIGNEES,
      });
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest(app, {
        query: ACTIVE_TEMPLATE,
        variables: { typeId, kind: DocumentKind.CONTRACT, unitId: unitBId },
        headers: asHeader(unitAId),
      });

      expect(response.errors?.[0]?.message).toBe('Organization unit not found');
    });

    it('resolves for the caller own unit', async () => {
      const template = await createDocumentTemplate(db, {
        organizationId,
        organizationUnitId: unitAId,
        reimbursementTypeId: typeId,
        kind: DocumentKind.CONTRACT,
        signees: SIGNEES,
      });
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest<{
        activeDocumentTemplate: { id: string };
      }>(app, {
        query: ACTIVE_TEMPLATE,
        variables: { typeId, kind: DocumentKind.CONTRACT, unitId: unitAId },
        headers: asHeader(unitAId),
      });

      expect(response.errors).toBeUndefined();
      expect(response.data?.activeDocumentTemplate.id).toBe(template.id);
    });
  });
  describe('documentTemplates and documentTemplate reads', () => {
    const seed = (organizationUnitId: string | null) =>
      createDocumentTemplate(db, {
        organizationId,
        organizationUnitId,
        reimbursementTypeId: typeId,
        kind: DocumentKind.CONTRACT,
        signees: SIGNEES,
      });

    it('lists org-wide, ancestor, own and descendant templates but not siblings', async () => {
      const childOfA = await createUnit(db, {
        organizationId,
        typeId: unitTypeId,
        name: 'child of a',
        parentId: unitAId,
      });
      const orgWide = await seed(null);
      const atRoot = await seed(rootId);
      const atA = await seed(unitAId);
      const atChildOfA = await seed(childOfA.id);
      const atB = await seed(unitBId);
      setAuthMockUserId(ownerOnAId);

      const response = await graphqlRequest<{
        documentTemplates: Array<{ id: string }>;
      }>(app, { query: LIST_TEMPLATES, headers: asHeader(unitAId) });

      expect(response.errors).toBeUndefined();
      const ids = response.data?.documentTemplates.map((t) => t.id) ?? [];
      expect(ids.sort()).toEqual(
        [orgWide.id, atRoot.id, atA.id, atChildOfA.id].sort(),
      );
      expect(ids).not.toContain(atB.id);
    });

    it('returns a readable template and hides a sibling one behind NotFound', async () => {
      const atRoot = await seed(rootId);
      const atB = await seed(unitBId);
      setAuthMockUserId(ownerOnAId);

      const readable = await graphqlRequest<{
        documentTemplate: { id: string };
      }>(app, {
        query: GET_TEMPLATE,
        variables: { id: atRoot.id },
        headers: asHeader(unitAId),
      });
      const hidden = await graphqlRequest(app, {
        query: GET_TEMPLATE,
        variables: { id: atB.id },
        headers: asHeader(unitAId),
      });

      expect(readable.errors).toBeUndefined();
      expect(readable.data?.documentTemplate.id).toBe(atRoot.id);
      expect(hidden.errors?.[0]?.message).toBe('Document template not found');
    });
  });
});

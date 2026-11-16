import 'reflect-metadata';
import {
  beforeAll,
  describe,
  expect,
  it,
  mock,
  setDefaultTimeout,
} from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  SigneeType,
} from '../src/accounting/enums';
import { ChangeArea } from '../src/change-feed/enums';
import type { Database } from '../src/database/database.module';
import * as schema from '../src/database/schema';
import {
  createDocumentTemplate,
  createReimbursementType,
  stubInvoiceDocumentNumber,
} from './factories/accounting.factory';
import { createMembershipRequest } from './factories/membership-request.factory';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createUser } from './factories/user.factory';
import { applyBunAuthMocks } from './helpers/auth-mocks';
import { getGraphqlTestContext } from './helpers/graphql-test-context';

applyBunAuthMocks(mock.module);
setDefaultTimeout(20_000);

/**
 * Every test gets its own organisation + root unit, so the log rows asserted on
 * are only ever the ones this test's writes produced — the file shares one test
 * database (and one memoized GraphQL context) with every other integration spec.
 */
type Fixture = { organizationId: string; unitId: string };

describe('change feed triggers', () => {
  let db: Database;
  let reimbursementTypeId: string;

  const createFixture = async (): Promise<Fixture> => {
    const { organization, type } = await createOrganizationWithType(
      db,
      `Change Feed Org ${crypto.randomUUID()}`,
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'root',
    });

    return { organizationId: organization.id, unitId: unit.id };
  };

  const createTemplate = (fixture: Fixture, kind: DocumentKind) =>
    createDocumentTemplate(db, {
      organizationId: fixture.organizationId,
      organizationUnitId: fixture.unitId,
      reimbursementTypeId,
      kind,
      signees: [{ order: 0, signeeType: SigneeType.VOLUNTEER }],
    });

  const insertContract = async (fixture: Fixture, volunteerId: string) => {
    const template = await createTemplate(fixture, DocumentKind.CONTRACT);
    const [contract] = await db
      .insert(schema.contracts)
      .values({
        documentTemplateId: template.id,
        volunteerId,
        reimbursementTypeId,
        organizationUnitId: fixture.unitId,
        contractStatus: ContractStatus.ACTIVE,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-01-01T00:00:00.000Z'),
        resolvedBody: { header: {}, blocks: [], footer: {} },
      })
      .returning();
    if (!contract) throw new Error('Failed to insert contract');
    return contract;
  };

  const insertInvoice = async (fixture: Fixture, volunteerId: string) => {
    const template = await createTemplate(fixture, DocumentKind.INVOICE);
    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        documentTemplateId: template.id,
        volunteerId,
        reimbursementTypeId,
        organizationUnitId: fixture.unitId,
        invoiceStatus: InvoiceStatus.READY,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T00:00:00.000Z'),
        totalAmountCents: 4_500,
        hourlyRateCents: 1_500,
        totalHours: 3,
        resolvedBody: { header: {}, blocks: [], footer: {} },
        ...stubInvoiceDocumentNumber(fixture.unitId),
      })
      .returning();
    if (!invoice) throw new Error('Failed to insert invoice');
    return invoice;
  };

  const entriesFor = (
    organizationUnitId: string,
    userIds?: string[],
    area?: ChangeArea,
  ) =>
    db
      .select()
      .from(schema.changeFeedEntries)
      .where(
        and(
          eq(schema.changeFeedEntries.organizationUnitId, organizationUnitId),
          area ? eq(schema.changeFeedEntries.area, area) : undefined,
          userIds?.length
            ? inArray(schema.changeFeedEntries.userId, userIds)
            : undefined,
        ),
      )
      .orderBy(schema.changeFeedEntries.id);

  beforeAll(async () => {
    const context = await getGraphqlTestContext();
    db = context.db;
    const reimbursementType = await createReimbursementType(db);
    reimbursementTypeId = reimbursementType.id;
  });

  it('records a contracts entry with unit and volunteer on insert, update and delete', async () => {
    const fixture = await createFixture();
    const volunteer = await createUser(db);

    const contract = await insertContract(fixture, volunteer.id);
    await db
      .update(schema.contracts)
      .set({ contractStatus: ContractStatus.EXPIRED })
      .where(eq(schema.contracts.id, contract.id));
    await db
      .delete(schema.contracts)
      .where(eq(schema.contracts.id, contract.id));

    const entries = await entriesFor(
      fixture.unitId,
      undefined,
      ChangeArea.CONTRACTS,
    );

    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.area).toBe(ChangeArea.CONTRACTS);
      expect(entry.organizationUnitId).toBe(fixture.unitId);
      expect(entry.userId).toBe(volunteer.id);
      expect(entry.createdAt).toBeInstanceOf(Date);
    }
  });

  it('records an invoices entry with unit and volunteer', async () => {
    const fixture = await createFixture();
    const volunteer = await createUser(db);

    const invoice = await insertInvoice(fixture, volunteer.id);

    const entries = await entriesFor(
      fixture.unitId,
      [volunteer.id],
      ChangeArea.INVOICES,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      area: ChangeArea.INVOICES,
      organizationUnitId: fixture.unitId,
      userId: volunteer.id,
    });
    expect(invoice.volunteerId).toBe(volunteer.id);
  });

  it('records a membership-requests entry with unit and user', async () => {
    const fixture = await createFixture();
    const applicant = await createUser(db);

    await createMembershipRequest(db, {
      userId: applicant.id,
      organizationUnitId: fixture.unitId,
    });

    const entries = await entriesFor(
      fixture.unitId,
      [applicant.id],
      ChangeArea.MEMBERSHIP_REQUESTS,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      area: ChangeArea.MEMBERSHIP_REQUESTS,
      organizationUnitId: fixture.unitId,
      userId: applicant.id,
    });
  });

  it('records nothing when the writing transaction rolls back', async () => {
    const fixture = await createFixture();
    const applicant = await createUser(db);
    const rollback = new Error('roll back the membership request');

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(schema.membershipRequests).values({
          userId: applicant.id,
          organizationUnitId: fixture.unitId,
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    const entries = await entriesFor(fixture.unitId);

    expect(entries).toEqual([]);
    const [request] = await db
      .select()
      .from(schema.membershipRequests)
      .where(eq(schema.membershipRequests.userId, applicant.id));
    expect(request).toBeUndefined();
  });

  it('stamps entries with the writing transaction id', async () => {
    const fixture = await createFixture();
    const first = await createUser(db);
    const second = await createUser(db);

    await db.transaction(async (tx) => {
      await tx.insert(schema.membershipRequests).values({
        userId: first.id,
        organizationUnitId: fixture.unitId,
      });
      await tx.insert(schema.membershipRequests).values({
        userId: second.id,
        organizationUnitId: fixture.unitId,
      });
    });

    const entries = await entriesFor(fixture.unitId, [first.id, second.id]);

    expect(entries).toHaveLength(2);
    const xids = new Set(entries.map((entry) => entry.xid));
    expect(xids.size).toBe(1);
    for (const entry of entries) {
      expect(entry.xid).toMatch(/^\d+$/);
    }
  });
});

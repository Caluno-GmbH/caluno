import { beforeAll, describe, expect, it } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BundleDeliveryMethod,
  ReimbursementTypeKey,
} from '../src/accounting/enums';
import {
  BundleDeliveryLogService,
  type InvoiceDeliveryRecord,
} from '../src/accounting/services/bundle-delivery-log.service';
import type { Database } from '../src/database/database.module';
import { DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import { EmailDeliveryStatus } from '../src/notification/email/outbox/email-outbox.enums';
import { createReimbursementType } from './factories/accounting.factory';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createUser } from './factories/user.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

const AT_9 = new Date('2026-08-01T09:00:00.000Z');
const AT_10 = new Date('2026-08-01T10:00:00.000Z');
const AT_11 = new Date('2026-08-01T11:00:00.000Z');

describe('BundleDeliveryLogService.findDeliveriesByInvoiceId', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: BundleDeliveryLogService;
  let organizationUnitId: string;
  let volunteerId: string;
  let deliveredByUserId: string;

  closeTestingModuleAfterAll(() => moduleRef);

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);
    service = new BundleDeliveryLogService(db);

    const { organization, type } = await createOrganizationWithType(
      db,
      'Delivery Log',
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'Root',
    });
    organizationUnitId = unit.id;

    const sender = await createUser(db);
    const volunteer = await createUser(db);
    volunteerId = volunteer.id;
    deliveredByUserId = sender.id;
    await createReimbursementType(db);
  });

  const record = (
    invoiceIds: string[],
    overrides: Partial<{
      method: BundleDeliveryMethod;
      occurredAt: Date;
      emailStatus: EmailDeliveryStatus;
    }> = {},
  ) =>
    service.record({
      organizationUnitId,
      volunteerId,
      deliveredByUserId,
      reimbursementTypeKey: ReimbursementTypeKey.EHRENAMT,
      method: overrides.method ?? BundleDeliveryMethod.DOWNLOAD,
      invoiceIds,
      occurredAt: overrides.occurredAt ?? AT_9,
      ...(overrides.emailStatus ? { emailStatus: overrides.emailStatus } : {}),
    });

  const idsFor = (
    map: Map<string, InvoiceDeliveryRecord[]>,
    invoiceId: string,
  ) => (map.get(invoiceId) ?? []).map((delivery) => delivery.method);

  it('groups each invoice’s deliveries newest first', async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    await record([a, b], { occurredAt: AT_9 });
    await record([a], {
      method: BundleDeliveryMethod.EMAIL,
      occurredAt: AT_10,
      emailStatus: EmailDeliveryStatus.SENT,
    });

    const byInvoice = await service.findDeliveriesByInvoiceId([a, b]);

    expect(idsFor(byInvoice, a)).toEqual([
      BundleDeliveryMethod.EMAIL,
      BundleDeliveryMethod.DOWNLOAD,
    ]);
    expect(idsFor(byInvoice, b)).toEqual([BundleDeliveryMethod.DOWNLOAD]);
  });

  it('carries the settled email status and leaves downloads statusless', async () => {
    const invoiceId = crypto.randomUUID();
    await record([invoiceId], { occurredAt: AT_9 });
    await record([invoiceId], {
      method: BundleDeliveryMethod.EMAIL,
      occurredAt: AT_11,
      emailStatus: EmailDeliveryStatus.FAILED,
    });

    const [latest, earlier] = (
      await service.findDeliveriesByInvoiceId([invoiceId])
    ).get(invoiceId) as InvoiceDeliveryRecord[];

    expect(latest?.status).toBe(EmailDeliveryStatus.FAILED);
    expect(earlier?.status).toBeNull();
    expect(latest?.deliveredByUserId).toBe(deliveredByUserId);
  });

  it('returns only the requested invoices when a delivery covers several', async () => {
    const requested = crypto.randomUUID();
    const other = crypto.randomUUID();
    await record([requested, other], { occurredAt: AT_10 });

    const byInvoice = await service.findDeliveriesByInvoiceId([requested]);

    expect([...byInvoice.keys()]).toEqual([requested]);
    expect(byInvoice.get(requested)).toHaveLength(1);
  });

  it('omits invoices that were never delivered', async () => {
    const known = crypto.randomUUID();
    await record([known], { occurredAt: AT_9 });

    const byInvoice = await service.findDeliveriesByInvoiceId([
      known,
      crypto.randomUUID(),
    ]);

    expect(byInvoice.has(known)).toBe(true);
    expect(byInvoice.size).toBe(1);
  });

  it('returns an empty map without touching the database for no ids', async () => {
    expect((await service.findDeliveriesByInvoiceId([])).size).toBe(0);
  });
});

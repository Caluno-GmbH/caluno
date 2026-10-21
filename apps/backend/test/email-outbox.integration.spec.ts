import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { type Database, DatabaseModule } from '../src/database/database.module';
import { DATABASE_CONNECTION } from '../src/database/database-connection';
import * as schema from '../src/database/schema';
import type { EmailSendResult } from '../src/notification/email/email-transport.service';
import {
  EmailCategory,
  EmailDeliveryStatus,
} from '../src/notification/email/outbox/email-outbox.enums';
import {
  EmailOutboxService,
  type EnqueueEmailInput,
} from '../src/notification/email/outbox/email-outbox.service';
import {
  ShiftCallOutDeliveryStatus,
  ShiftCallOutSource,
} from '../src/shift/enums';
import {
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
import { createShift } from './factories/shift.factory';
import { createUser } from './factories/user.factory';
import {
  closeTestingModuleAfterAll,
  ensureTestDatabase,
} from './helpers/ensure-test-database';

describe('EmailOutboxService', () => {
  let moduleRef: TestingModule;
  let db: Database;
  let service: EmailOutboxService;
  let organizationUnitId: string;
  let counter = 0;

  const sendOnce = mock(
    async (): Promise<EmailSendResult> => ({
      ok: true,
      providerMessageId: 'provider-1',
    }),
  );

  closeTestingModuleAfterAll(() => moduleRef);

  beforeAll(async () => {
    await ensureTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();
    db = moduleRef.get<Database>(DATABASE_CONNECTION);

    const { organization, type } = await createOrganizationWithType(
      db,
      'Outbox Test Org',
    );
    const unit = await createUnit(db, {
      organizationId: organization.id,
      typeId: type.id,
      name: 'Outbox Unit',
    });
    organizationUnitId = unit.id;

    service = new EmailOutboxService(db, { sendOnce } as never);
  });

  beforeEach(async () => {
    // Retire rows left pending by the previous test so drain() is isolated.
    await db
      .update(schema.emailOutbox)
      .set({ status: EmailDeliveryStatus.CANCELLED })
      .where(
        inArray(schema.emailOutbox.status, [
          EmailDeliveryStatus.PENDING,
          EmailDeliveryStatus.SENDING,
        ]),
      );
    sendOnce.mockClear();
    sendOnce.mockImplementation(async () => ({
      ok: true,
      providerMessageId: 'provider-1',
    }));
  });

  function buildInput(
    overrides: Partial<EnqueueEmailInput> = {},
  ): EnqueueEmailInput {
    counter += 1;
    return {
      category: EmailCategory.NOTIFICATION,
      to: `volunteer-${counter}@example.com`,
      subject: `Subject ${counter}`,
      html: '<p>Body</p>',
      organizationUnitId,
      dedupeKey: `test-dedupe-${counter}`,
      ...overrides,
    };
  }

  function enqueue(overrides: Partial<EnqueueEmailInput> = {}) {
    return service.enqueue(buildInput(overrides));
  }

  async function findRow(id: string) {
    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.id, id));
    return row;
  }

  it('enqueues a pending row and is idempotent by dedupe key', async () => {
    const first = await enqueue({ dedupeKey: 'same-action' });
    const second = await enqueue({ dedupeKey: 'same-action' });

    expect(second.id).toBe(first.id);
    expect(first.status).toBe(EmailDeliveryStatus.PENDING);
    expect(first.attempts).toBe(0);
  });

  it('marks the row SENT and stores the provider message id', async () => {
    const row = await enqueue();

    const summary = await service.drain();

    expect(summary.sent).toBeGreaterThanOrEqual(1);
    const updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.SENT);
    expect(updated?.providerMessageId).toBe('provider-1');
    expect(updated?.sentAt).toBeInstanceOf(Date);
  });

  it('schedules a retry with backoff for a retryable failure', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: true,
      error: new Error('The operation timed out'),
    }));
    const row = await enqueue();

    const summary = await service.drain();

    expect(summary.retried).toBeGreaterThanOrEqual(1);
    const updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.PENDING);
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toContain('timed out');
    expect(updated?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('fails permanently on a non-retryable error', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: false,
      error: new Error('invalid recipient'),
    }));
    const row = await enqueue();

    const summary = await service.drain();

    expect(summary.failed).toBeGreaterThanOrEqual(1);
    const updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.FAILED);
    expect(updated?.lastError).toContain('invalid recipient');
  });

  it('cancels an expired row without calling the transport', async () => {
    const row = await enqueue({
      expiresAt: new Date(Date.now() - 60_000),
    });

    const summary = await service.drain();

    expect(summary.cancelled).toBeGreaterThanOrEqual(1);
    const updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.CANCELLED);
    expect(sendOnce).not.toHaveBeenCalled();
  });

  it('gives up once maxAttempts is exhausted', async () => {
    sendOnce.mockImplementation(async () => ({
      ok: false,
      retryable: true,
      error: new Error('provider timeout'),
    }));
    const row = await enqueue({ maxAttempts: 2 });

    await service.drain();
    let updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.PENDING);
    expect(updated?.attempts).toBe(1);

    // Make the row due immediately instead of waiting for the backoff.
    await db
      .update(schema.emailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.emailOutbox.id, row.id));

    const due = await findRow(row.id);
    expect(due?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
    const second = await service.drain();
    expect(second.claimed).toBeGreaterThanOrEqual(1);

    updated = await findRow(row.id);
    expect(updated?.status).toBe(EmailDeliveryStatus.FAILED);
    expect(updated?.attempts).toBe(2);
    expect(sendOnce).toHaveBeenCalledTimes(2);
  });

  it('delivers inline and returns the transport result', async () => {
    const outcome = await service.enqueueAndDeliver(buildInput());

    expect(outcome.result).toEqual({
      ok: true,
      providerMessageId: 'provider-1',
    });
    expect(outcome.row.status).toBe(EmailDeliveryStatus.SENT);
  });

  it('leaves a retryable inline failure queued', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: true,
      error: new Error('provider timeout'),
    }));

    const outcome = await service.enqueueAndDeliver(buildInput());

    expect(outcome.result.ok).toBe(false);
    expect(outcome.row.status).toBe(EmailDeliveryStatus.PENDING);
    expect(outcome.row.attempts).toBe(1);
    expect(outcome.row.lastError).toContain('provider timeout');
  });

  it('reclaims a stale SENDING row and delivers it', async () => {
    const row = await enqueue();
    await db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.SENDING,
        attempts: 1,
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      })
      .where(eq(schema.emailOutbox.id, row.id));

    const summary = await service.drain();

    expect(summary.claimed).toBeGreaterThanOrEqual(1);
    expect((await findRow(row.id))?.status).toBe(EmailDeliveryStatus.SENT);
  });

  it('does not send the same row twice when two drains race', async () => {
    sendOnce.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, providerMessageId: 'provider-race' };
    });
    const first = await enqueue();
    const second = await enqueue();

    await Promise.all([service.drain(), service.drain()]);

    expect(sendOnce).toHaveBeenCalledTimes(2);
    expect((await findRow(first.id))?.status).toBe(EmailDeliveryStatus.SENT);
    expect((await findRow(second.id))?.status).toBe(EmailDeliveryStatus.SENT);
  });

  it('mirrors a fast send onto audit rows inserted afterwards', async () => {
    const recipient = await createUser(db);
    const sender = await createUser(db);
    const shift = await createShift(db, {
      organizationUnitId,
      createdById: sender.id,
    });
    const [instance] = await db
      .select()
      .from(schema.shiftInstances)
      .where(eq(schema.shiftInstances.masterId, shift.id))
      .limit(1);
    if (!instance) throw new Error('Failed to create shift instance');

    const row = await enqueue();
    // Simulate the worker winning the race: the email is SENT before the
    // caller inserts its audit row.
    await service.drain();
    expect((await findRow(row.id))?.status).toBe(EmailDeliveryStatus.SENT);

    await db.insert(schema.shiftCallOutRecipients).values({
      instanceId: instance.id,
      recipientId: recipient.id,
      sentById: sender.id,
      status: ShiftCallOutDeliveryStatus.PENDING,
      source: ShiftCallOutSource.MANUAL,
      sentAt: new Date(),
      outboxId: row.id,
    });

    await service.refreshAuditStatuses([row.id]);

    const [audit] = await db
      .select()
      .from(schema.shiftCallOutRecipients)
      .where(eq(schema.shiftCallOutRecipients.outboxId, row.id));
    expect(audit?.status).toBe(ShiftCallOutDeliveryStatus.SENT);
  });
});

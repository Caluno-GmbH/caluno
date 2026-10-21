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
  createOrganizationWithType,
  createUnit,
} from './factories/org.factory';
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
    // Retire emails left pending by the previous test so drain() is isolated.
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

  function buildEmailInput(
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
    return service.enqueue(buildEmailInput(overrides));
  }

  async function findOutboxEmail(id: string) {
    const [outboxEmail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.id, id));
    return outboxEmail;
  }

  it('enqueues a pending email and is idempotent by dedupe key', async () => {
    const firstEmail = await enqueue({ dedupeKey: 'same-action' });
    const secondEmail = await enqueue({ dedupeKey: 'same-action' });

    expect(secondEmail.id).toBe(firstEmail.id);
    expect(firstEmail.status).toBe(EmailDeliveryStatus.PENDING);
    expect(firstEmail.attempts).toBe(0);
  });

  it('marks the email SENT and stores the provider message id', async () => {
    const outboxEmail = await enqueue();

    const drainSummary = await service.drain();

    expect(drainSummary.sent).toBeGreaterThanOrEqual(1);
    const updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.SENT);
    expect(updatedEmail?.providerMessageId).toBe('provider-1');
    expect(updatedEmail?.sentAt).toBeInstanceOf(Date);
  });

  it('schedules a retry with backoff for a retryable failure', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: true,
      error: new Error('The operation timed out'),
    }));
    const outboxEmail = await enqueue();

    const drainSummary = await service.drain();

    expect(drainSummary.retried).toBeGreaterThanOrEqual(1);
    const updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.PENDING);
    expect(updatedEmail?.attempts).toBe(1);
    expect(updatedEmail?.lastError).toContain('timed out');
    expect(updatedEmail?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('fails permanently on a non-retryable error', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: false,
      error: new Error('invalid recipient'),
    }));
    const outboxEmail = await enqueue();

    const drainSummary = await service.drain();

    expect(drainSummary.failed).toBeGreaterThanOrEqual(1);
    const updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.FAILED);
    expect(updatedEmail?.lastError).toContain('invalid recipient');
  });

  it('cancels an expired email without calling the transport', async () => {
    const outboxEmail = await enqueue({
      expiresAt: new Date(Date.now() - 60_000),
    });

    const drainSummary = await service.drain();

    expect(drainSummary.cancelled).toBeGreaterThanOrEqual(1);
    const updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.CANCELLED);
    expect(sendOnce).not.toHaveBeenCalled();
  });

  it('gives up once maxAttempts is exhausted', async () => {
    sendOnce.mockImplementation(async () => ({
      ok: false,
      retryable: true,
      error: new Error('provider timeout'),
    }));
    const outboxEmail = await enqueue({ maxAttempts: 2 });

    await service.drain();
    let updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.PENDING);
    expect(updatedEmail?.attempts).toBe(1);

    // Make the email due immediately instead of waiting for the backoff.
    await db
      .update(schema.emailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.emailOutbox.id, outboxEmail.id));

    const dueEmail = await findOutboxEmail(outboxEmail.id);
    expect(dueEmail?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
    const secondDrainSummary = await service.drain();
    expect(secondDrainSummary.claimed).toBeGreaterThanOrEqual(1);

    updatedEmail = await findOutboxEmail(outboxEmail.id);
    expect(updatedEmail?.status).toBe(EmailDeliveryStatus.FAILED);
    expect(updatedEmail?.attempts).toBe(2);
    expect(sendOnce).toHaveBeenCalledTimes(2);
  });

  it('delivers inline and returns the transport result', async () => {
    const deliveryOutcome = await service.enqueueAndDeliver(buildEmailInput());

    expect(deliveryOutcome.result).toEqual({
      ok: true,
      providerMessageId: 'provider-1',
    });
    expect(deliveryOutcome.outboxEmail.status).toBe(EmailDeliveryStatus.SENT);
  });

  it('leaves a retryable inline failure queued', async () => {
    sendOnce.mockImplementationOnce(async () => ({
      ok: false,
      retryable: true,
      error: new Error('provider timeout'),
    }));

    const deliveryOutcome = await service.enqueueAndDeliver(buildEmailInput());

    expect(deliveryOutcome.result.ok).toBe(false);
    expect(deliveryOutcome.outboxEmail.status).toBe(
      EmailDeliveryStatus.PENDING,
    );
    expect(deliveryOutcome.outboxEmail.attempts).toBe(1);
    expect(deliveryOutcome.outboxEmail.lastError).toContain('provider timeout');
  });

  it('reclaims a stale SENDING email and delivers it', async () => {
    const outboxEmail = await enqueue();
    await db
      .update(schema.emailOutbox)
      .set({
        status: EmailDeliveryStatus.SENDING,
        attempts: 1,
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      })
      .where(eq(schema.emailOutbox.id, outboxEmail.id));

    const drainSummary = await service.drain();

    expect(drainSummary.claimed).toBeGreaterThanOrEqual(1);
    expect((await findOutboxEmail(outboxEmail.id))?.status).toBe(
      EmailDeliveryStatus.SENT,
    );
  });

  it('does not send the same email twice when two drains race', async () => {
    sendOnce.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, providerMessageId: 'provider-race' };
    });
    const firstEmail = await enqueue();
    const secondEmail = await enqueue();

    await Promise.all([service.drain(), service.drain()]);

    expect(sendOnce).toHaveBeenCalledTimes(2);
    expect((await findOutboxEmail(firstEmail.id))?.status).toBe(
      EmailDeliveryStatus.SENT,
    );
    expect((await findOutboxEmail(secondEmail.id))?.status).toBe(
      EmailDeliveryStatus.SENT,
    );
  });
});

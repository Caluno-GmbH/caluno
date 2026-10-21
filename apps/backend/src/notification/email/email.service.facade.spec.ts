import { describe, expect, it, mock } from 'bun:test';
import { EmailService } from './email.service';
import type { EmailSendResult } from './email-transport.service';
import { EmailCategory } from './outbox/email-outbox.enums';

function setup(result: EmailSendResult = { ok: true, providerMessageId: 'x' }) {
  const outbox = {
    enqueue: mock(async () => ({ id: 'outbox-1' })),
    enqueueAndDeliver: mock(async () => ({
      result,
      row: { id: 'outbox-1' },
    })),
  };
  return { service: new EmailService(outbox as never), outbox };
}

const MESSAGE = {
  to: 'volunteer@example.com',
  subject: 'Subject',
  html: '<p>Body</p>',
};

describe('EmailService', () => {
  it('queues normal email with the notification category', async () => {
    const { service, outbox } = setup();

    await service.send({ ...MESSAGE, userId: 'user-1' });

    expect(outbox.enqueue).toHaveBeenCalledWith({
      ...MESSAGE,
      userId: 'user-1',
      category: EmailCategory.NOTIFICATION,
    });
  });

  it('attempts auth email immediately with the auth category and expiry', async () => {
    const { service, outbox } = setup();
    const expiresAt = new Date(Date.now() + 60_000);

    await service.sendImmediately(MESSAGE, { expiresAt });

    expect(outbox.enqueueAndDeliver).toHaveBeenCalledWith({
      ...MESSAGE,
      category: EmailCategory.AUTH,
      expiresAt,
      dedupeKey: undefined,
    });
  });

  it('throws on a non-retryable immediate failure', async () => {
    const { service } = setup({
      ok: false,
      retryable: false,
      error: new Error('invalid recipient'),
    });

    await expect(service.sendImmediately(MESSAGE)).rejects.toThrow(
      'invalid recipient',
    );
  });

  it('swallows a retryable immediate failure for the worker', async () => {
    const { service } = setup({
      ok: false,
      retryable: true,
      error: new Error('timeout'),
    });

    await expect(service.sendImmediately(MESSAGE)).resolves.toBeUndefined();
  });
});

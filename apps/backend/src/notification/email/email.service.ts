import { Injectable, Logger } from '@nestjs/common';
import { maskEmail } from '../../utils';
import type { EmailSendOptions } from './email-transport.service';
import { EmailCategory } from './outbox/email-outbox.enums';
import { EmailOutboxService } from './outbox/email-outbox.service';

export interface EmailDeliveryOptions {
  /** Stop retrying after this instant (e.g. an OTP that has expired). */
  expiresAt?: Date;
  /** Idempotency key for re-runs of the same action. */
  dedupeKey?: string;
}

/**
 * `send()` enqueues for the worker. `sendImmediately()` also attempts once
 * now, for latency-sensitive auth mail; retryable failures stay queued.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly outbox: EmailOutboxService) {}

  async send(email: EmailSendOptions): Promise<void> {
    await this.outbox.enqueue({
      ...email,
      category: EmailCategory.NOTIFICATION,
    });
  }

  async sendImmediately(
    email: EmailSendOptions,
    deliveryOptions: EmailDeliveryOptions = {},
  ): Promise<void> {
    const { result: deliveryResult } = await this.outbox.enqueueAndDeliver({
      ...email,
      category: EmailCategory.AUTH,
      expiresAt: deliveryOptions.expiresAt,
      dedupeKey: deliveryOptions.dedupeKey,
    });

    if (!deliveryResult.ok && !deliveryResult.retryable) {
      throw deliveryResult.error;
    }
    if (!deliveryResult.ok) {
      this.logger.warn(
        `Email to ${email.userId ?? 'unknown'}:${maskEmail(email.to)} failed transiently; left queued for retry: ${deliveryResult.error.message}`,
      );
    }
  }
}

export type {
  EmailAttachment,
  EmailSendOptions,
} from './email-transport.service';

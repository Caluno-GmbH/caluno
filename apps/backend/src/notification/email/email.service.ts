import { Injectable, Logger } from '@nestjs/common';
import { maskEmail } from '../../utils';
import type { EmailSendOptions } from './email-transport.service';
import { EmailCategory } from './outbox/email-outbox.enums';
import { EmailOutboxService } from './outbox/email-outbox.service';

export interface EmailOutboxOptions {
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

  async send(options: EmailSendOptions): Promise<void> {
    await this.outbox.enqueue({
      ...options,
      category: EmailCategory.NOTIFICATION,
    });
  }

  async sendImmediately(
    options: EmailSendOptions,
    outboxOptions: EmailOutboxOptions = {},
  ): Promise<void> {
    const { result } = await this.outbox.enqueueAndDeliver({
      ...options,
      category: EmailCategory.AUTH,
      expiresAt: outboxOptions.expiresAt,
      dedupeKey: outboxOptions.dedupeKey,
    });

    if (!result.ok && !result.retryable) {
      throw result.error;
    }
    if (!result.ok) {
      this.logger.warn(
        `Email to ${options.userId ?? 'unknown'}:${maskEmail(options.to)} failed transiently; left queued for retry: ${result.error.message}`,
      );
    }
  }
}

export type {
  EmailAttachment,
  EmailSendOptions,
} from './email-transport.service';

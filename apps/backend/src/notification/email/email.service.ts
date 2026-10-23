import { Injectable, Logger } from '@nestjs/common';
import { maskEmail } from '../../utils';
import type { EmailSendOptions } from './email-transport.service';
import { EmailCategory } from './outbox/email-outbox.enums';
import { EmailOutboxService } from './outbox/email-outbox.service';

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
    expiresAt: Date,
  ): Promise<void> {
    const { result: deliveryResult } = await this.outbox.enqueueAndDeliver({
      ...email,
      category: EmailCategory.AUTH,
      expiresAt,
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

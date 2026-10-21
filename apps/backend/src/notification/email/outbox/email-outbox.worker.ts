import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailOutboxService } from './email-outbox.service';

/**
 * Drains the outbox every 10 seconds. The in-process guard serialises ticks
 * per replica; `FOR UPDATE SKIP LOCKED` handles cross-replica concurrency.
 */
@Injectable()
export class EmailOutboxWorkerService {
  private readonly logger = new Logger(EmailOutboxWorkerService.name);
  private isDraining = false;

  constructor(private readonly outbox: EmailOutboxService) {}

  @Cron('*/10 * * * * *', { timeZone: 'Europe/Berlin' })
  async handleTick(): Promise<void> {
    if (this.isDraining) {
      this.logger.debug(
        { event: 'email_outbox.tick_skipped_running' },
        'Previous outbox drain is still running',
      );
      return;
    }

    this.isDraining = true;
    const drainStartedAt = Date.now();
    try {
      const drainSummary = await this.outbox.drain();
      if (drainSummary.claimed > 0) {
        this.logger.log(
          {
            event: 'email_outbox.drained',
            duration_ms: Date.now() - drainStartedAt,
            ...drainSummary,
          },
          'Email outbox drained',
        );
      }
    } catch (drainError) {
      this.logger.error(
        {
          event: 'email_outbox.drain_failed',
          duration_ms: Date.now() - drainStartedAt,
          err: drainError,
        },
        'Email outbox drain failed',
      );
    } finally {
      this.isDraining = false;
    }
  }
}

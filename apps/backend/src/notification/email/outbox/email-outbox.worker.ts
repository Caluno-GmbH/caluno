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
  private running = false;

  constructor(private readonly outbox: EmailOutboxService) {}

  @Cron('*/10 * * * * *', { timeZone: 'Europe/Berlin' })
  async handleTick(): Promise<void> {
    if (this.running) {
      this.logger.debug(
        { event: 'email_outbox.tick_skipped_running' },
        'Previous outbox drain is still running',
      );
      return;
    }

    this.running = true;
    const startedAt = Date.now();
    try {
      const summary = await this.outbox.drain();
      if (summary.claimed > 0) {
        this.logger.log(
          {
            event: 'email_outbox.drained',
            duration_ms: Date.now() - startedAt,
            ...summary,
          },
          'Email outbox drained',
        );
      }
    } catch (error) {
      this.logger.error(
        {
          event: 'email_outbox.drain_failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'Email outbox drain failed',
      );
    } finally {
      this.running = false;
    }
  }
}

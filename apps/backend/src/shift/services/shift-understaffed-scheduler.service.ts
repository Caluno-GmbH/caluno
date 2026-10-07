import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShiftUnderstaffedNotificationService } from './shift-understaffed-notification.service';

/**
 * Thin scheduler trigger, kept separate from ShiftUnderstaffedNotificationService
 * so the actual state-machine logic is unit-testable without touching Nest's
 * scheduler. One hourly tick, Europe/Berlin — no event-driven dropout hook,
 * see the understaffed-shift email package design.
 */
@Injectable()
export class ShiftUnderstaffedSchedulerService {
  private readonly logger = new Logger(ShiftUnderstaffedSchedulerService.name);

  constructor(
    private readonly notificationService: ShiftUnderstaffedNotificationService,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Europe/Berlin' })
  async handleTick(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log({ event: 'understaffed_tick.started' }, 'Tick started');

    try {
      const summary = await this.notificationService.runTick();
      this.logger.log(
        {
          event: 'understaffed_tick.finished',
          duration_ms: Date.now() - startedAt,
          ...summary,
        },
        'Tick finished',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'understaffed_tick.failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'Tick failed',
      );
    }
  }
}

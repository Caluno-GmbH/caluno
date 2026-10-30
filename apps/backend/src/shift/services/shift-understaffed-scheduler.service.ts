import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  BERLIN_CRON_OPTIONS,
  HOURLY_BERLIN_CRON,
  runLockedSchedulerTick,
} from '../../shared/run-locked-scheduler-tick';
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
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron(HOURLY_BERLIN_CRON, BERLIN_CRON_OPTIONS)
  async handleTick(): Promise<void> {
    await runLockedSchedulerTick({
      logger: this.logger,
      advisoryLock: this.advisoryLock,
      lockKey: ADVISORY_LOCK_KEYS.shiftUnderstaffedTick,
      event: 'shift_understaffed_tick',
      run: () => this.notificationService.runTick(),
    });
  }
}

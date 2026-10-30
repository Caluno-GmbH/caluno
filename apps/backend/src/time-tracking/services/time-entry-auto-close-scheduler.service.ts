import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import { TimeEntryAutoCloseSweepService } from './time-entry-auto-close-sweep.service';

/**
 * Thin scheduler trigger, kept separate from TimeEntryAutoCloseSweepService so
 * the sweep stays testable without Nest's scheduler. One hourly tick,
 * Europe/Berlin, under an advisory lock so only one instance closes entries
 * and sends the emails.
 */
@Injectable()
export class TimeEntryAutoCloseSchedulerService {
  private readonly logger = new Logger(TimeEntryAutoCloseSchedulerService.name);

  constructor(
    private readonly sweepService: TimeEntryAutoCloseSweepService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Europe/Berlin' })
  async handleTick(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(
      { event: 'time_entry_auto_close_tick.started' },
      'TimeEntryAutoClose tick started',
    );

    try {
      const summary = await this.advisoryLock.tryWithLock(
        ADVISORY_LOCK_KEYS.timeEntryAutoCloseTick,
        () => this.sweepService.runTick(),
      );
      if (summary === null) {
        this.logger.log(
          {
            event: 'time_entry_auto_close_tick.skipped_locked',
            duration_ms: Date.now() - startedAt,
          },
          'Another instance is running TimeEntryAutoClose tick; skipping',
        );
        return;
      }

      this.logger.log(
        {
          event: 'time_entry_auto_close_tick.finished',
          duration_ms: Date.now() - startedAt,
          ...summary,
        },
        'TimeEntryAutoClose tick finished',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'time_entry_auto_close_tick.failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'TimeEntryAutoClose tick failed',
      );
    }
  }
}

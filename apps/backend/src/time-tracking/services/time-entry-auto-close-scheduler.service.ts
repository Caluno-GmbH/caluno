import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  BERLIN_CRON_OPTIONS,
  HOURLY_BERLIN_CRON,
  runLockedSchedulerTick,
} from '../../shared/run-locked-scheduler-tick';
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

  @Cron(HOURLY_BERLIN_CRON, BERLIN_CRON_OPTIONS)
  async handleTick(): Promise<void> {
    await runLockedSchedulerTick({
      logger: this.logger,
      advisoryLock: this.advisoryLock,
      lockKey: ADVISORY_LOCK_KEYS.timeEntryAutoCloseTick,
      event: 'time_entry_auto_close_tick',
      run: () => this.sweepService.runTick(),
    });
  }
}

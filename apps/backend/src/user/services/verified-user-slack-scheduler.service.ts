import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  BERLIN_CRON_OPTIONS,
  runLockedSchedulerTick,
} from '../../shared/run-locked-scheduler-tick';
import { VerifiedUserSlackReportService } from './verified-user-slack-report.service';

/** Daily at 09:00 Europe/Berlin. */
export const VERIFIED_USER_SLACK_CRON = '0 9 * * *' as const;

/**
 * Thin scheduler trigger for the daily verified-user Slack count. Kept
 * separate from VerifiedUserSlackReportService so the report stays unit-
 * testable without Nest's scheduler.
 */
@Injectable()
export class VerifiedUserSlackSchedulerService {
  private readonly logger = new Logger(VerifiedUserSlackSchedulerService.name);

  constructor(
    private readonly reportService: VerifiedUserSlackReportService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron(VERIFIED_USER_SLACK_CRON, BERLIN_CRON_OPTIONS)
  async handleTick(): Promise<void> {
    await runLockedSchedulerTick({
      logger: this.logger,
      advisoryLock: this.advisoryLock,
      lockKey: ADVISORY_LOCK_KEYS.verifiedUserSlackTick,
      event: 'verified_user_slack_tick',
      run: () => this.reportService.runTick(),
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import { ShiftPauseApprovalSweepService } from './shift-pause-approval-sweep.service';

/**
 * Thin scheduler trigger, kept separate from ShiftPauseApprovalSweepService
 * so the actual sweep logic is unit-testable without touching Nest's
 * scheduler. One hourly tick, Europe/Berlin — mirrors the understaffed-shift
 * scheduler's shape: invites already sitting in AWAITING_ADMIN_APPROVAL are
 * moved onto the waitlist once the pause covers them, and told when a seat
 * is free. New sign-ups still skip approval on their own.
 */
@Injectable()
export class ShiftPauseApprovalSchedulerService {
  private readonly logger = new Logger(ShiftPauseApprovalSchedulerService.name);

  constructor(
    private readonly sweepService: ShiftPauseApprovalSweepService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Europe/Berlin' })
  async handleTick(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(
      { event: 'pause_approval_tick.started' },
      'ShiftPauseApproval tick started',
    );

    try {
      const summary = await this.advisoryLock.tryWithLock(
        ADVISORY_LOCK_KEYS.shiftPauseApprovalTick,
        () => this.sweepService.runTick(),
      );
      if (summary === null) {
        this.logger.log(
          {
            event: 'pause_approval_tick.skipped_locked',
            duration_ms: Date.now() - startedAt,
          },
          'Another instance is running ShiftPauseApproval tick; skipping',
        );
        return;
      }

      this.logger.log(
        {
          event: 'pause_approval_tick.finished',
          duration_ms: Date.now() - startedAt,
          ...summary,
        },
        'ShiftPauseApproval tick finished',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'pause_approval_tick.failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'ShiftPauseApproval tick failed',
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  BERLIN_CRON_OPTIONS,
  HOURLY_BERLIN_CRON,
  runLockedSchedulerTick,
} from '../../shared/run-locked-scheduler-tick';
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

  @Cron(HOURLY_BERLIN_CRON, BERLIN_CRON_OPTIONS)
  async handleTick(): Promise<void> {
    await runLockedSchedulerTick({
      logger: this.logger,
      advisoryLock: this.advisoryLock,
      lockKey: ADVISORY_LOCK_KEYS.shiftPauseApprovalTick,
      event: 'shift_pause_approval_tick',
      run: () => this.sweepService.runTick(),
    });
  }
}

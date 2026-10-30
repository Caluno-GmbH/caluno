import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import { VolunteerDigestService } from './volunteer-digest.service';

/**
 * Thin scheduler trigger, kept separate from VolunteerDigestService so the
 * digest send stays testable without Nest's scheduler. One hourly tick,
 * Europe/Berlin, under an advisory lock so only one instance sends digests.
 */
@Injectable()
export class VolunteerDigestSchedulerService {
  private readonly logger = new Logger(VolunteerDigestSchedulerService.name);

  constructor(
    private readonly volunteerDigestService: VolunteerDigestService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Europe/Berlin' })
  async handleDigestTick(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(
      { event: 'volunteer_digest.started' },
      'VolunteerDigest tick started',
    );

    try {
      const summary = await this.advisoryLock.tryWithLock(
        ADVISORY_LOCK_KEYS.volunteerDigestTick,
        () => this.volunteerDigestService.sendDigests(),
      );
      if (summary === null) {
        this.logger.log(
          {
            event: 'volunteer_digest.skipped_locked',
            duration_ms: Date.now() - startedAt,
          },
          'Another instance is running VolunteerDigest tick; skipping',
        );
        return;
      }

      this.logger.log(
        {
          event: 'volunteer_digest.finished',
          duration_ms: Date.now() - startedAt,
          ...summary,
        },
        'VolunteerDigest tick finished',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'volunteer_digest.failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'VolunteerDigest tick failed',
      );
    }
  }
}

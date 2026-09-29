import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VolunteerDigestService } from './volunteer-digest.service';

/**
 * Thin scheduler trigger, kept separate from VolunteerDigestService so the
 * digest-building logic is unit-testable without touching Nest's scheduler.
 * Sunday 08:00 Europe/Berlin, matching the existing understaffed-shift
 * scheduler's timezone convention (no per-org/per-user timezone exists).
 */
@Injectable()
export class VolunteerDigestSchedulerService {
  private readonly logger = new Logger(VolunteerDigestSchedulerService.name);

  constructor(
    private readonly volunteerDigestService: VolunteerDigestService,
  ) {}

  @Cron('0 8 * * 0', { timeZone: 'Europe/Berlin' })
  async handleSundayDigest(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log(
      { event: 'volunteer_digest.started' },
      'Digest run started',
    );

    try {
      const summary = await this.volunteerDigestService.sendDigests();
      this.logger.log(
        {
          event: 'volunteer_digest.finished',
          duration_ms: Date.now() - startedAt,
          ...summary,
        },
        'Digest run finished',
      );
    } catch (error) {
      this.logger.error(
        {
          event: 'volunteer_digest.failed',
          duration_ms: Date.now() - startedAt,
          err: error,
        },
        'Digest run failed',
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VolunteerDigestService } from './volunteer-digest.service';

@Injectable()
export class VolunteerDigestSchedulerService {
  private readonly logger = new Logger(VolunteerDigestSchedulerService.name);

  constructor(
    private readonly volunteerDigestService: VolunteerDigestService,
  ) {}

  @Cron('*/15 * * * *', { timeZone: 'Europe/Berlin' })
  async handleDigestTick(): Promise<void> {
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

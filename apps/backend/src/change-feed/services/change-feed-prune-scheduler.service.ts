import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  BERLIN_CRON_OPTIONS,
  HOURLY_BERLIN_CRON,
  runLockedSchedulerTick,
} from '../../shared/run-locked-scheduler-tick';
import { ChangeFeedService } from './change-feed.service';

/**
 * Thin scheduler trigger, kept separate from ChangeFeedService so pruning stays
 * testable without Nest's scheduler. One hourly tick, Europe/Berlin, under an
 * advisory lock so only one instance prunes the feed at a time.
 */
@Injectable()
export class ChangeFeedPruneSchedulerService {
  private readonly logger = new Logger(ChangeFeedPruneSchedulerService.name);

  constructor(
    private readonly changeFeedService: ChangeFeedService,
    private readonly advisoryLock: AdvisoryLockService,
  ) {}

  @Cron(HOURLY_BERLIN_CRON, BERLIN_CRON_OPTIONS)
  async handleTick(): Promise<void> {
    await runLockedSchedulerTick({
      logger: this.logger,
      advisoryLock: this.advisoryLock,
      lockKey: ADVISORY_LOCK_KEYS.changeFeedPruneTick,
      event: 'change_feed_prune_tick',
      run: () => this.changeFeedService.pruneExpired(new Date()),
    });
  }
}

import type { Logger } from '@nestjs/common';
import type { AdvisoryLockService } from '../database/advisory-lock.service';

/** Hourly on the hour, Europe/Berlin — the default cadence for locked ticks. */
export const HOURLY_BERLIN_CRON = '0 * * * *' as const;
export const BERLIN_CRON_OPTIONS = { timeZone: 'Europe/Berlin' } as const;

export interface LockedSchedulerTickOptions<TSummary extends object> {
  logger: Pick<Logger, 'log' | 'error'>;
  advisoryLock: AdvisoryLockService;
  /** Postgres advisory lock key from `ADVISORY_LOCK_KEYS`. */
  lockKey: number;
  /**
   * Structured-log event stem, e.g. `understaffed_tick` →
   * `.started` / `.skipped_locked` / `.finished` / `.failed`.
   */
  event: string;
  run: () => Promise<TSummary>;
}

/**
 * Shared body for thin Nest `@Cron` scheduler services: log start, run under
 * an advisory lock, log summary / skip / failure. Errors are swallowed so a
 * failed tick never kills the Nest scheduler process.
 */
export async function runLockedSchedulerTick<TSummary extends object>(
  options: LockedSchedulerTickOptions<TSummary>,
): Promise<void> {
  const { logger, advisoryLock, lockKey, event, run } = options;
  const startedAt = Date.now();

  logger.log({ event: `${event}.started` }, `${event} started`);

  try {
    const summary = await advisoryLock.tryWithLock(lockKey, run);
    if (summary === null) {
      logger.log(
        {
          event: `${event}.skipped_locked`,
          duration_ms: Date.now() - startedAt,
        },
        `Another instance is running ${event}; skipping`,
      );
      return;
    }

    logger.log(
      {
        event: `${event}.finished`,
        duration_ms: Date.now() - startedAt,
        ...summary,
      },
      `${event} finished`,
    );
  } catch (error) {
    logger.error(
      {
        event: `${event}.failed`,
        duration_ms: Date.now() - startedAt,
        err: error,
      },
      `${event} failed`,
    );
  }
}

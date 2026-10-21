import { Injectable, Logger } from '@nestjs/common';
import { DatabasePoolService } from './database-pool.service';

/**
 * Runs background work under a session-level Postgres advisory lock so that
 * only one backend instance performs it when the service is scaled out.
 *
 * The lock is taken on a dedicated pooled connection and released in a
 * `finally` block. If the unlock itself fails, the connection is destroyed:
 * Postgres drops session locks when the backend disconnects, so a crashed or
 * wedged run never leaves the job blocked.
 */
@Injectable()
export class AdvisoryLockService {
  private readonly logger = new Logger(AdvisoryLockService.name);

  constructor(private readonly poolService: DatabasePoolService) {}

  /**
   * Acquire `key` without blocking and run `run` while holding it.
   *
   * Returns `null` when another instance already holds the lock (the caller
   * should skip this tick); otherwise returns `run`'s result. Errors from
   * `run` propagate after the lock has been released.
   */
  async tryWithLock<T>(key: number, run: () => Promise<T>): Promise<T | null> {
    const client = await this.poolService.pool.connect();
    let locked = false;

    try {
      const result = await client.query<{ locked: boolean }>(
        'select pg_try_advisory_lock($1) as locked',
        [key],
      );
      locked = result.rows[0]?.locked === true;
      if (!locked) {
        this.logger.log(
          { event: 'advisory_lock.not_acquired', lock_key: key },
          'Another instance holds the advisory lock; skipping',
        );
        return null;
      }

      return await run();
    } finally {
      if (locked) {
        try {
          await client.query('select pg_advisory_unlock($1)', [key]);
          client.release();
        } catch {
          client.release(true);
        }
      } else {
        client.release();
      }
    }
  }
}

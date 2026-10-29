import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { PoolClient } from 'pg';
import { DatabasePoolService } from '../database/database.module';

// Must stay below the platform probe timeout (3s) so the 503 is ours.
const PING_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly poolService: DatabasePoolService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const { pool } = this.poolService;

    // A saturated pool cannot serve requests; queueing a probe behind real
    // traffic would only deepen the backlog.
    if (pool.waitingCount > 0) {
      this.logger.warn('database pool saturated, skipping ping');
      return indicator.down({ message: 'unavailable' });
    }

    let client: PoolClient | undefined;
    let failure: Error | undefined;
    try {
      client = await pool.connect();
      // Server-side timeout, so a hung ping is cancelled instead of lingering.
      await client.query('begin');
      await client.query(`set local statement_timeout = ${PING_TIMEOUT_MS}`);
      await client.query('select 1');
      await client.query('commit');
      return indicator.up();
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`database ping failed: ${failure.message}`);
      return indicator.down({ message: 'unavailable' });
    } finally {
      // Passing the error destroys the connection rather than pooling it.
      client?.release(failure);
    }
  }
}

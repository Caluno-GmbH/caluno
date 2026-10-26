import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/** Owns the pg Pool and ends it when the Nest module is destroyed. */
@Injectable()
export class DatabasePoolService implements OnModuleDestroy {
  readonly pool: Pool;
  private readonly logger = new Logger(DatabasePoolService.name);
  private ended = false;

  constructor(configService: ConfigService) {
    this.pool = new Pool({
      host: configService.getOrThrow('DB_HOST'),
      port: parseInt(configService.getOrThrow('DB_PORT'), 10),
      user: configService.getOrThrow('DB_USER'),
      password: configService.getOrThrow('DB_PASSWORD'),
      database: configService.getOrThrow('DB_NAME'),
      ssl: false,
      max: parseInt(configService.get('DB_POOL_MAX') ?? '25', 10),
      idleTimeoutMillis: parseInt(
        configService.get('DB_POOL_IDLE_TIMEOUT_MS') ?? '120000',
        10,
      ),
      keepAlive: true,
    });
    // Without a listener, an error on an idle client (DB restart, failover)
    // is an unhandled 'error' event and kills the process. The pool discards
    // the client and reconnects on the next query.
    this.pool.on('error', (error) => {
      this.logger.error(`idle database client error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ended) {
      return;
    }
    this.ended = true;
    await this.pool.end();
  }
}

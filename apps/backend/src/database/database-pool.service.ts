import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/** Owns the pg Pool and ends it when the Nest module is destroyed. */
@Injectable()
export class DatabasePoolService implements OnModuleDestroy {
  readonly pool: Pool;
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
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ended) {
      return;
    }
    this.ended = true;
    await this.pool.end();
  }
}

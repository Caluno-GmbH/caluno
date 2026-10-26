import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AdvisoryLockService } from './advisory-lock.service';
import { DATABASE_CONNECTION } from './database-connection';
import { DatabasePoolService } from './database-pool.service';
import { relations } from './relations';

export type Database = NodePgDatabase<typeof relations>;

export { DatabasePoolService } from './database-pool.service';

@Module({
  imports: [ConfigModule],
  providers: [
    DatabasePoolService,
    AdvisoryLockService,
    {
      provide: DATABASE_CONNECTION,
      useFactory: (poolService: DatabasePoolService): Database =>
        drizzle({
          client: poolService.pool,
          relations,
        }),
      inject: [DatabasePoolService],
    },
  ],
  exports: [DATABASE_CONNECTION, AdvisoryLockService],
})
export class DatabaseModule {}

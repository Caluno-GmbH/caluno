import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationUnitDataModule } from '../organization/organization-unit-data.module';
import { ChangeFeedQueryResolver } from './resolvers/change-feed-query.resolver';
import { ChangeFeedService } from './services/change-feed.service';
import { ChangeFeedPruneSchedulerService } from './services/change-feed-prune-scheduler.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationUnitDataModule,
    ConfigModule,
  ],
  providers: [
    ChangeFeedService,
    ChangeFeedQueryResolver,
    ChangeFeedPruneSchedulerService,
  ],
  exports: [ChangeFeedService],
})
export class ChangeFeedModule {}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { TermsMutationResolver } from './resolvers/terms-mutation.resolver';
import { TermsQueryResolver } from './resolvers/terms-query.resolver';
import { TERMS_DIRECTORY, TermsService } from './services/terms.service';
import { TermsAutoPublishService } from './services/terms-auto-publish.service';
import { TermsNotificationService } from './services/terms-notification.service';
import { TermsPublishService } from './services/terms-publish.service';
import { TermsController } from './terms.controller';
import { defaultTermsDirectory } from './terms-files';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [TermsController],
  providers: [
    { provide: TERMS_DIRECTORY, useFactory: defaultTermsDirectory },
    TermsService,
    TermsNotificationService,
    TermsPublishService,
    TermsAutoPublishService,
    TermsQueryResolver,
    TermsMutationResolver,
  ],
  exports: [
    TermsService,
    TermsNotificationService,
    TermsPublishService,
    TermsAutoPublishService,
  ],
})
export class TermsModule {}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TermsMutationResolver } from './resolvers/terms-mutation.resolver';
import { TermsQueryResolver } from './resolvers/terms-query.resolver';
import { TERMS_DIRECTORY, TermsService } from './services/terms.service';
import { TermsController } from './terms.controller';
import { defaultTermsDirectory } from './terms-files';

@Module({
  imports: [DatabaseModule],
  controllers: [TermsController],
  providers: [
    { provide: TERMS_DIRECTORY, useFactory: defaultTermsDirectory },
    TermsService,
    TermsQueryResolver,
    TermsMutationResolver,
  ],
  exports: [TermsService],
})
export class TermsModule {}

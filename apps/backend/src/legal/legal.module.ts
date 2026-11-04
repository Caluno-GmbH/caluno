import { Module } from '@nestjs/common';
import { TermsModule } from '../terms/terms.module';
import { LegalController } from './legal.controller';
import { LegalService, PRIVACY_POLICY_DIRECTORY } from './legal.service';
import { defaultPrivacyPolicyDirectory } from './privacy-policy-files';

@Module({
  imports: [TermsModule],
  controllers: [LegalController],
  providers: [
    {
      provide: PRIVACY_POLICY_DIRECTORY,
      useFactory: defaultPrivacyPolicyDirectory,
    },
    LegalService,
  ],
  exports: [LegalService],
})
export class LegalModule {}

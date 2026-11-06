import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AllowUnacceptedTerms } from '../terms/guards/allow-unaccepted-terms.decorator';
import { TermsService } from '../terms/services/terms.service';
import { LegalService } from './legal.service';

export type LegalDocumentsSummary = {
  privacyNotice: { lastChangedOn: string };
  terms: { version: string; lastChangedOn: string } | null;
};

@Controller('legal')
export class LegalController {
  constructor(
    private readonly legalService: LegalService,
    private readonly termsService: TermsService,
  ) {}

  @Get('privacy-policy.pdf')
  @AllowAnonymous()
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  streamPrivacyPolicy(): StreamableFile {
    return this.legalService.streamCurrentPrivacyPolicy();
  }

  @Get('documents')
  @AllowAnonymous()
  @AllowUnacceptedTerms()
  @Header('Cache-Control', 'no-store')
  async documents(): Promise<LegalDocumentsSummary> {
    const terms = await this.termsService.getCurrentVersion();
    return {
      privacyNotice: {
        lastChangedOn: this.legalService.getCurrentPrivacyNoticeDate(),
      },
      terms: terms
        ? { version: terms.version, lastChangedOn: terms.date }
        : null,
    };
  }
}

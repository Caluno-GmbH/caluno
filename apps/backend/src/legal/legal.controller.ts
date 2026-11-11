import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AllowUnacceptedTerms } from '../terms/guards/allow-unaccepted-terms.decorator';
import { TermsService } from '../terms/services/terms.service';
import { LegalService } from './legal.service';
import { isPrivacyPolicyLocale } from './privacy-policy-files';

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

  @Get('privacy-policy/:locale')
  @AllowAnonymous()
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  streamPrivacyPolicy(@Param('locale') locale: string): StreamableFile {
    if (!isPrivacyPolicyLocale(locale)) {
      throw new BadRequestException('Unsupported privacy policy locale');
    }
    try {
      return this.legalService.streamCurrentPrivacyPolicy(locale);
    } catch {
      throw new NotFoundException('Privacy policy document not found');
    }
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

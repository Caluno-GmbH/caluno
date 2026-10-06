import { createReadStream } from 'node:fs';
import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { BadRequestGraphQLError } from '../graphql/errors';
import { AllowUnacceptedTerms } from './guards/allow-unaccepted-terms.decorator';
import { TermsService, type TermsStatus } from './services/terms.service';
import { isTermsLocale } from './terms-files';

@Controller('legal/terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get('status')
  @AllowUnacceptedTerms()
  @Header('Cache-Control', 'no-store')
  async status(@Session() session: UserSession): Promise<TermsStatus> {
    return this.termsService.getStatusForUser(session.user.id);
  }

  @Get('current/:locale')
  @AllowAnonymous()
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  async current(@Param('locale') locale: string): Promise<StreamableFile> {
    const current = await this.termsService.getCurrentVersion();
    if (!current) {
      throw new BadRequestGraphQLError('No published terms version');
    }
    return this.stream(current.version, locale);
  }

  @Get(':version/:locale')
  @AllowAnonymous()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  streamVersion(
    @Param('version') version: string,
    @Param('locale') locale: string,
  ): StreamableFile {
    return this.stream(version, locale);
  }

  private stream(version: string, locale: string): StreamableFile {
    if (!isTermsLocale(locale)) {
      throw new BadRequestGraphQLError('Unsupported terms locale');
    }
    const document = this.termsService.resolveDocument(version, locale);
    return new StreamableFile(createReadStream(document.path), {
      type: 'application/pdf',
      disposition: `inline; filename="${document.filename}"`,
    });
  }
}

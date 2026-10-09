import { createReadStream } from 'node:fs';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
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
  @AllowUnacceptedTerms()
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  async current(@Param('locale') locale: string): Promise<StreamableFile> {
    const current = await this.termsService.getCurrentVersion();
    if (!current) {
      throw new BadRequestException('No published terms version');
    }
    return this.stream(current.version, locale);
  }

  @Get(':version/:locale')
  @AllowAnonymous()
  @AllowUnacceptedTerms()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  streamVersion(
    @Param('version') version: string,
    @Param('locale') locale: string,
  ): StreamableFile {
    return this.stream(version, locale);
  }

  private stream(version: string, locale: string): StreamableFile {
    if (!isTermsLocale(locale)) {
      throw new BadRequestException('Unsupported terms locale');
    }
    let document: { path: string; filename: string };
    try {
      document = this.termsService.resolveDocument(version, locale);
    } catch {
      throw new NotFoundException('Terms document not found');
    }
    return new StreamableFile(createReadStream(document.path), {
      type: 'application/pdf',
      disposition: `inline; filename="${document.filename}"`,
    });
  }
}

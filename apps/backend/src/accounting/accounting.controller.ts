import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  type HttpException,
  NotFoundException,
  Query,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { GraphQLError } from 'graphql';
import { PERMISSIONS } from '../auth/constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { DownloadBundleQueryDto } from './dto/download-bundle-query.dto';
import { AccountingOrgAccessService } from './services';
import { BundleDownloadService } from './services/bundle-download.service';

const HTTP_EXCEPTION_FOR_CODE: Record<
  string,
  new (
    message: string,
  ) => HttpException
> = {
  BAD_REQUEST: BadRequestException,
  FORBIDDEN: ForbiddenException,
  NOT_FOUND: NotFoundException,
};

/**
 * Shared services raise GraphQL errors, which a REST route would answer with a
 * bare 500. They are re-raised as the matching HTTP exception, so the status
 * the client gets is the one the error means.
 */
function asHttpException(error: unknown): unknown {
  if (error instanceof GraphQLError) {
    const HttpError = HTTP_EXCEPTION_FOR_CODE[String(error.extensions?.code)];
    if (HttpError) return new HttpError(error.message);
  }
  return error;
}

/**
 * REST surface for the reimbursement workflow's file delivery. Bytes never go
 * through GraphQL, so the "download bundle" action is a plain authenticated
 * GET that streams the ZIP of a volunteer/type's ready documents.
 */
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly bundleDownloadService: BundleDownloadService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
  ) {}

  @Get('reimbursement-bundle/download')
  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async downloadBundle(
    @Session() session: UserSession,
    @Headers('x-organization-unit-id') organizationUnitId: string | undefined,
    @Query() query: DownloadBundleQueryDto,
  ): Promise<StreamableFile> {
    if (!organizationUnitId) {
      throw new BadRequestException('Missing organization unit context.');
    }
    try {
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        organizationUnitId,
      );
    } catch (error) {
      throw asHttpException(error);
    }

    const { buffer, zipName } = await this.bundleDownloadService.buildAndRecord(
      organizationUnitId,
      query.volunteerId,
      query.reimbursementTypeId,
      session.user.id,
      query.invoiceIds,
    );

    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="${zipName}"`,
    });
  }
}

import {
  Controller,
  Get,
  Headers,
  Query,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../auth/constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BadRequestGraphQLError } from '../graphql/errors';
import { DownloadBundleQueryDto } from './dto/download-bundle-query.dto';
import { AccountingOrgAccessService } from './services';
import { BundleDownloadService } from './services/bundle-download.service';

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
      throw new BadRequestGraphQLError('Missing organization unit context.');
    }
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      organizationUnitId,
    );

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

import {
  Controller,
  Get,
  Headers,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../auth/constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BadRequestGraphQLError } from '../graphql/errors';
import { AccountingOrgAccessService } from './services';
import { BundleDownloadService } from './services/bundle-download.service';

/** Far above what one volunteer has ready; keeps the list and the query bounded. */
const MAX_NAMED_INVOICES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The timesheets the board shows, as a comma separated list of ids. Left out,
 * every READY timesheet of the volunteer and type is bundled.
 */
function parseInvoiceIds(value: unknown): string[] | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestGraphQLError('Invalid list of timesheets.');
  }
  const ids = value.split(',');
  if (ids.length > MAX_NAMED_INVOICES || ids.some((id) => !UUID.test(id))) {
    throw new BadRequestGraphQLError('Invalid list of timesheets.');
  }
  return ids;
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
  async downloadBundle(
    @Session() session: UserSession,
    @Headers('x-organization-unit-id') organizationUnitId: string | undefined,
    @Query('volunteerId') volunteerId: unknown,
    @Query('reimbursementTypeId') reimbursementTypeId: unknown,
    @Query('invoiceIds') invoiceIds: unknown,
  ): Promise<StreamableFile> {
    if (!organizationUnitId) {
      throw new BadRequestGraphQLError('Missing organization unit context.');
    }
    if (
      typeof volunteerId !== 'string' ||
      typeof reimbursementTypeId !== 'string'
    ) {
      throw new BadRequestGraphQLError(
        'Missing volunteer or reimbursement type.',
      );
    }
    const named = parseInvoiceIds(invoiceIds);
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      organizationUnitId,
    );

    const { buffer, zipName } = await this.bundleDownloadService.buildAndRecord(
      organizationUnitId,
      volunteerId,
      reimbursementTypeId,
      session.user.id,
      named,
    );

    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="${zipName}"`,
    });
  }
}

import { Args, Context, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import { ReimbursementTypeKey } from '../enums';
import { ReimbursementTypeMapper } from '../mappers';
import { BundleDelivery } from '../models/bundle-delivery.model';
import { BundleSendPreview } from '../models/bundle-send-preview.model';
import { AccountingOrgAccessService } from '../services';
import {
  BundleDeliveryLogService,
  DEFAULT_DELIVERY_LOG_PAGE_SIZE,
} from '../services/bundle-delivery-log.service';
import { BundleEmailService } from '../services/bundle-email.service';

@Resolver(() => BundleDelivery)
export class BundleDeliveryQueryResolver {
  constructor(
    private readonly bundleEmailService: BundleEmailService,
    private readonly bundleDeliveryLogService: BundleDeliveryLogService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly tenantScopeService: TenantScopeService,
    private readonly reimbursementTypeMapper: ReimbursementTypeMapper,
  ) {}

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => BundleSendPreview)
  async bundleSendPreview(
    @Args('volunteerId', { type: () => ID }) volunteerId: string,
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: ReimbursementTypeKey,
    @Args('invoiceIds', { type: () => [ID], nullable: true })
    invoiceIds: string[] | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<BundleSendPreview> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      volunteerId,
      'Volunteer not found',
    );
    return this.bundleEmailService.preview({
      organizationId,
      scope: {
        volunteerId,
        reimbursementTypeId,
        organizationUnitId: context.organizationUnitId,
      },
      invoiceIds: invoiceIds ?? undefined,
      sender: { id: session.user.id, name: session.user.name },
      locale: context.locale,
    });
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => [BundleDelivery])
  async bundleDeliveries(
    @Args('limit', {
      type: () => Int,
      nullable: true,
      defaultValue: DEFAULT_DELIVERY_LOG_PAGE_SIZE,
    })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<BundleDelivery[]> {
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      context.organizationUnitId,
    );
    const rows = await this.bundleDeliveryLogService.list(
      context.organizationUnitId,
      { limit, offset },
    );
    return rows.map((row) => ({
      id: row.id,
      method: row.method,
      volunteer: row.volunteer,
      reimbursementType: this.reimbursementTypeMapper.toModel(
        row.reimbursementType,
      ),
      invoiceIds: row.invoiceIds,
      recipientEmail: row.recipientEmail,
      subject: row.subject,
      issues: row.issues,
      emailStatus: row.emailStatus,
      deliveredByUser: row.deliveredByUser,
      occurredAt: row.occurredAt,
    }));
  }
}

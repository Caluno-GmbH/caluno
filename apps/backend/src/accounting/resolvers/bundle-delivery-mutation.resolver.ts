import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import { BundleDeliveryIssue } from '../enums';
import { BundleDelivery } from '../models/bundle-delivery.model';
import { AccountingOrgAccessService } from '../services';
import { BundleEmailService } from '../services/bundle-email.service';

@Resolver(() => BundleDelivery)
export class BundleDeliveryMutationResolver {
  constructor(
    private readonly bundleEmailService: BundleEmailService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  /**
   * Emails the bundle to the unit's accounting address. Every issue the
   * server finds must be in `acknowledgedIssues`, else CONFLICT.
   */
  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Mutation(() => BundleDelivery)
  async sendReimbursementBundle(
    @Args('volunteerId', { type: () => ID }) volunteerId: string,
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: string,
    @Args('invoiceIds', { type: () => [ID], nullable: true })
    invoiceIds: string[] | null | undefined,
    @Args('acknowledgedIssues', {
      type: () => [BundleDeliveryIssue],
      defaultValue: [],
    })
    acknowledgedIssues: BundleDeliveryIssue[],
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<BundleDelivery> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      volunteerId,
      'Volunteer not found',
    );
    const delivery = await this.bundleEmailService.send({
      organizationId,
      scope: {
        volunteerId,
        reimbursementTypeId,
        organizationUnitId: context.organizationUnitId,
      },
      invoiceIds: invoiceIds ?? undefined,
      sender: { id: session.user.id, name: session.user.name },
      locale: context.locale,
      acknowledgedIssues,
    });
    return {
      id: delivery.id,
      method: delivery.method,
      invoiceIds: delivery.invoiceIds,
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      issues: delivery.issues,
      occurredAt: delivery.occurredAt,
    };
  }
}

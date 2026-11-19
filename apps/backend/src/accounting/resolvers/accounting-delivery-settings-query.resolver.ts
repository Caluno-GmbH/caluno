import { Context, Query, Resolver } from '@nestjs/graphql';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { AccountingDeliverySettings } from '../models/accounting-delivery-settings.model';
import { AccountingOrgAccessService } from '../services';
import { AccountingDeliverySettingsService } from '../services/accounting-delivery-settings.service';

@Resolver(() => AccountingDeliverySettings)
export class AccountingDeliverySettingsQueryResolver {
  constructor(
    private readonly deliverySettingsService: AccountingDeliverySettingsService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
  ) {}

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => AccountingDeliverySettings)
  async accountingDeliverySettings(
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<AccountingDeliverySettings> {
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      context.organizationUnitId,
    );
    return this.deliverySettingsService.resolve(
      context.organizationUnitId,
      context.locale,
    );
  }
}

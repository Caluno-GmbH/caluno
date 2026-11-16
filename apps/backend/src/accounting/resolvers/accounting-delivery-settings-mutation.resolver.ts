import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { UpdateAccountingDeliverySettingsInput } from '../inputs';
import { AccountingDeliverySettings } from '../models/accounting-delivery-settings.model';
import { AccountingOrgAccessService } from '../services';
import { AccountingDeliverySettingsService } from '../services/accounting-delivery-settings.service';

@Resolver(() => AccountingDeliverySettings)
export class AccountingDeliverySettingsMutationResolver {
  constructor(
    private readonly deliverySettingsService: AccountingDeliverySettingsService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
  ) {}

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Mutation(() => AccountingDeliverySettings)
  async updateAccountingDeliverySettings(
    @Args('input') input: UpdateAccountingDeliverySettingsInput,
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<AccountingDeliverySettings> {
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      context.organizationUnitId,
    );
    return this.deliverySettingsService.update(
      context.organizationUnitId,
      input,
      session.user.id,
      context.locale,
    );
  }
}

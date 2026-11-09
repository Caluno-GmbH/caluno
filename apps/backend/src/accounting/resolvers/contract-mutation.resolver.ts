import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import { CreateContractInput } from '../inputs/create-contract.input';
import { ContractMapper } from '../mappers';
import { Contract } from '../models/contract.model';
import {
  AccountingOrgAccessService,
  AccountingScopeService,
  ContractService,
} from '../services';

@Resolver(() => Contract)
export class ContractMutationResolver {
  constructor(
    private readonly contractService: ContractService,
    private readonly contractMapper: ContractMapper,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly tenantScopeService: TenantScopeService,
    private readonly accountingScopeService: AccountingScopeService,
  ) {}

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Mutation(() => Contract)
  async createContract(
    @Args('input') input: CreateContractInput,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract> {
    const organizationUnitId =
      input.organizationUnitId ?? context.organizationUnitId;

    // PermissionGuard only proves ACCOUNTING_MANAGE on the header unit. A
    // unit named in the input must still sit under that header
    // (assertUnitReadable). The volunteer must hold an active membership
    // somewhere under the *header* subtree — not the target unit — so a
    // root-member can still get a contract on a child/grandchild (nested
    // rates / unit address), while a manager in org B cannot mint a PDF of
    // a foreign volunteer's IBAN / birth date.
    if (
      input.organizationUnitId &&
      input.organizationUnitId !== context.organizationUnitId
    ) {
      await this.accountingScopeService.assertUnitReadable(
        context.organizationUnitId,
        input.organizationUnitId,
        'Organization unit not found',
      );
    }
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      input.volunteerId,
      'Volunteer not found',
    );

    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );

    const contract = await this.contractService.createContract(
      organizationId,
      {
        ...input,
        organizationUnitId,
      },
      session.user.id,
    );
    return this.contractMapper.toModelOrThrow(contract);
  }

  @Mutation(() => Contract)
  async signContract(
    @Args('contractId', { type: () => ID }) contractId: string,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract> {
    const contract = await this.contractService.signContract(
      contractId,
      session.user.id,
      context.organizationUnitId,
    );
    return this.contractMapper.toModelOrThrow(contract);
  }

  @Mutation(() => Contract)
  async declineContract(
    @Args('contractId', { type: () => ID }) contractId: string,
    @Args('reason') reason: string,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract> {
    const contract = await this.contractService.declineContract(
      contractId,
      session.user.id,
      reason,
      context.organizationUnitId,
    );
    return this.contractMapper.toModelOrThrow(contract);
  }
}

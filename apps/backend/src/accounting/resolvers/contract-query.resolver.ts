import { Args, Context, ID, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { NotFoundGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { OrganizationUnitService } from '../../organization/organization-unit.service';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import type { ContractFilter } from '../accounting.types';
import { isIssuedDocument } from '../document-visibility';
import { ContractStatus, DocumentKind } from '../enums';
import { ContractFilterInput } from '../inputs/contract-filter.input';
import { ContractMapper } from '../mappers';
import { Contract } from '../models/contract.model';
import { PendingSignee } from '../models/pending-signee.model';
import { AccountingOrgAccessService, ContractService } from '../services';

function toContractFilter(
  filter: ContractFilterInput | null | undefined,
): ContractFilter {
  return {
    volunteerId: filter?.volunteerId ?? undefined,
    reimbursementTypeId: filter?.reimbursementTypeId ?? undefined,
    status: filter?.status ?? undefined,
    periodStart: filter?.periodStart ?? undefined,
    periodEnd: filter?.periodEnd ?? undefined,
  };
}

@Resolver(() => Contract)
export class ContractQueryResolver {
  constructor(
    private readonly contractService: ContractService,
    private readonly contractMapper: ContractMapper,
    private readonly authService: AuthService,
    private readonly organizationUnitService: OrganizationUnitService,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  @Query(() => Contract)
  async contract(
    @Args('id', { type: () => ID }) id: string,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract> {
    const contract = await this.contractService.findContract(id);
    await this.assertCanViewDocument(
      contract.volunteerId,
      contract.contractStatus,
      contract.organizationUnitId,
      session,
      context,
    );
    return this.contractMapper.toModelOrThrow(contract);
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => [Contract])
  async contracts(
    @Args('filter', { type: () => ContractFilterInput, nullable: true })
    filter: ContractFilterInput | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract[]> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    const contracts = await this.contractService.findContractsForOrganization(
      organizationId,
      {
        ...toContractFilter(filter),
        organizationUnitId: context.organizationUnitId,
      },
    );
    return this.contractMapper.toArray(contracts);
  }

  @Query(() => [Contract])
  async myContracts(
    @Args('filter', { type: () => ContractFilterInput, nullable: true })
    filter: ContractFilterInput | null | undefined,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<Contract[]> {
    const organizationId = await this.resolveOrganizationId(context);
    const contracts = await this.contractService.findContractsForOrganization(
      organizationId,
      {
        ...toContractFilter(filter),
        volunteerId: session.user.id,
        issuedOnly: true,
      },
    );
    return this.contractMapper.toArray(contracts);
  }

  @Query(() => PendingSignee, { nullable: true })
  async pendingContractSignee(
    @Args('contractId', { type: () => ID }) contractId: string,
    @Session() session: UserSession,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<PendingSignee | null> {
    const contract = await this.contractService.findContract(contractId);
    await this.assertCanViewDocument(
      contract.volunteerId,
      contract.contractStatus,
      contract.organizationUnitId,
      session,
      context,
    );
    // Eligibility is always for the document's unit — never the client header
    // (owners can omit/spoof x-organization-unit-id on My documents).
    if (!contract.organizationUnitId) {
      throw new NotFoundGraphQLError('Contract not found');
    }
    return this.contractService.findPendingContractSignee(
      contractId,
      contract.organizationUnitId,
    );
  }

  private async assertCanViewDocument(
    volunteerId: string,
    status: ContractStatus | undefined,
    documentOrganizationUnitId: string | null | undefined,
    session: UserSession,
    context: AuthenticatedGraphQLContext,
  ): Promise<void> {
    const isOwner = session.user.id === volunteerId;
    const hasPermission = await this.authService.hasRequiredPermissions(
      session.user.id,
      context.organizationUnitId,
      [PERMISSIONS.ACCOUNTING_MANAGE],
    );
    // Same shape as missing — never Forbidden — so foreign ids stay opaque.
    if (!isOwner && !hasPermission) {
      throw new NotFoundGraphQLError('Contract not found');
    }
    if (
      isOwner &&
      !hasPermission &&
      status !== undefined &&
      !isIssuedDocument(DocumentKind.CONTRACT, status)
    ) {
      throw new NotFoundGraphQLError('Contract not found');
    }
    // Managers: permission is on the header unit only — prove the document
    // belongs to that unit (or a descendant) before returning anything.
    // Owners keep the cross-org "My documents" path without a unit match.
    if (!isOwner) {
      await this.tenantScopeService.assertResourceInScope(
        context.organizationUnitId,
        documentOrganizationUnitId,
        'Contract not found',
      );
    }
  }

  private async resolveOrganizationId(
    context: AuthenticatedGraphQLContext,
  ): Promise<string> {
    const organizationId =
      await this.organizationUnitService.findOrganizationIdByUnitId(
        context.organizationUnitId,
      );
    if (!organizationId) {
      throw new NotFoundGraphQLError('Organization not found');
    }
    return organizationId;
  }
}

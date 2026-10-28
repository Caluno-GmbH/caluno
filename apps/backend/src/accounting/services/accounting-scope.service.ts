import { Injectable } from '@nestjs/common';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { TenantScopeService } from '../../organization/tenant-scope.service';

/**
 * Scope rule for accounting writes (reimbursement rates, document templates).
 *
 * `PermissionGuard` only proves the caller holds `ACCOUNTING_MANAGE` on the
 * header unit. A row owned by a unit may only be written from that unit or
 * above it, and the org-wide row (no unit) only from the top unit, so a
 * sub-unit manager cannot change what units above or beside it use.
 * Rejects with NotFound so foreign ids stay indistinguishable from missing.
 */
@Injectable()
export class AccountingScopeService {
  constructor(
    private readonly tenantScopeService: TenantScopeService,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  /**
   * `targetUnitId` set: it must be the header unit or one of its descendants.
   * `targetUnitId` empty (org-wide row): the header unit must be the top unit.
   */
  async assertCanWrite(
    headerUnitId: string,
    targetUnitId: string | null | undefined,
    notFoundMessage: string,
  ): Promise<void> {
    if (targetUnitId) {
      if (targetUnitId !== headerUnitId) {
        await this.tenantScopeService.assertResourceInScope(
          headerUnitId,
          targetUnitId,
          notFoundMessage,
        );
      }
      return;
    }

    const headerUnit =
      await this.organizationUnitDataService.findById(headerUnitId);
    if (!headerUnit || headerUnit.parentId !== null) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }
  }
}

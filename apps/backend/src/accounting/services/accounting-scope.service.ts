import { Injectable } from '@nestjs/common';
import { NotFoundGraphQLError } from '../../graphql/errors';
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
  constructor(private readonly tenantScopeService: TenantScopeService) {}

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

    await this.tenantScopeService.assertHeaderUnitIsTopUnit(
      headerUnitId,
      notFoundMessage,
    );
  }

  /**
   * Reads are wider than writes: a unit sees what it inherits (org-wide rows
   * and rows of its ancestors) plus what it manages (its own row and rows of
   * its descendants). Siblings and other branches are excluded.
   */
  async filterReadable<T extends { organizationUnitId: string | null }>(
    headerUnitId: string,
    rows: T[],
  ): Promise<T[]> {
    const isOnBranch =
      this.tenantScopeService.createBranchMatcher(headerUnitId);
    const readable: T[] = [];
    for (const row of rows) {
      const unitId = row.organizationUnitId;
      if (!unitId || (await isOnBranch(unitId))) readable.push(row);
    }
    return readable;
  }

  /** Single-row form of {@link filterReadable}; rejects with NotFound. */
  async assertCanRead(
    headerUnitId: string,
    row: { organizationUnitId: string | null },
    notFoundMessage: string,
  ): Promise<void> {
    const readable = await this.filterReadable(headerUnitId, [row]);
    if (readable.length === 0) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }
  }

  /**
   * A unit named by the caller (e.g. a query argument) must be the header unit
   * or one of its descendants; rejects with NotFound.
   */
  async assertUnitReadable(
    headerUnitId: string,
    unitId: string,
    notFoundMessage: string,
  ): Promise<void> {
    if (unitId === headerUnitId) return;
    await this.tenantScopeService.assertResourceInScope(
      headerUnitId,
      unitId,
      notFoundMessage,
    );
  }
}

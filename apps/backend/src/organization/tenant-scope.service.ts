import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotFoundGraphQLError } from '../graphql/errors';
import { OrganizationUnitDataService } from './organization-unit-data.service';

/**
 * Proves that a resource loaded by id belongs to the caller's tenant.
 *
 * `PermissionGuard` only checks permissions on the header unit
 * (`x-organization-unit-id`); it says nothing about the resource a handler then
 * loads by id. Call these before returning or writing a resource.
 *
 * All reject with NotFound, never Forbidden, so a foreign id cannot be told
 * apart from a missing one.
 */
@Injectable()
export class TenantScopeService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  /**
   * The resource's unit must be the header unit or one of its descendants.
   * Rejects siblings, ancestors and other organizations.
   */
  async assertResourceInScope(
    headerUnitId: string,
    resourceUnitId: string | null | undefined,
    notFoundMessage = 'Resource not found',
  ): Promise<void> {
    if (!resourceUnitId) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }

    const ancestorUnitIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        resourceUnitId,
      );
    if (!ancestorUnitIds.includes(headerUnitId)) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }
  }

  /**
   * Builds a check for whether a unit sits on the header unit's branch: the
   * header unit itself, one of its ancestors, or one of its descendants.
   * Siblings and other organizations are off the branch. The header chain is
   * loaded once and each unit's verdict is memoised for the life of the
   * returned function, so scope one request's rows with one matcher.
   */
  createBranchMatcher(
    headerUnitId: string,
  ): (unitId: string) => Promise<boolean> {
    let headerChain: Promise<string[]> | undefined;
    const verdicts = new Map<string, boolean>();
    return async (unitId) => {
      headerChain ??=
        this.organizationUnitDataService.listInclusiveAncestorUnitIds(
          headerUnitId,
        );
      if ((await headerChain).includes(unitId)) return true;
      let isDescendant = verdicts.get(unitId);
      if (isDescendant === undefined) {
        const chain =
          await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
            unitId,
          );
        isDescendant = chain.includes(headerUnitId);
        verdicts.set(unitId, isDescendant);
      }
      return isDescendant;
    };
  }

  /**
   * The header unit must be its organization's top unit (no parent). For
   * organization-wide resources that only the top unit may change.
   */
  async assertHeaderUnitIsTopUnit(
    headerUnitId: string,
    notFoundMessage = 'Resource not found',
  ): Promise<void> {
    const headerUnit =
      await this.organizationUnitDataService.findById(headerUnitId);
    if (!headerUnit || headerUnit.parentId !== null) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }
  }

  /**
   * The user has a membership in the header unit or one of its descendants,
   * e.g. a volunteer whose accounting data the caller manages.
   */
  async assertUserInScope(
    headerUnitId: string,
    userId: string,
    notFoundMessage = 'User not found',
  ): Promise<void> {
    // Read memberships directly: MembershipModule imports this module, so
    // injecting MembershipService here would be a circular dependency.
    const memberships = await this.db.query.memberships.findMany({
      where: { userId },
      columns: { organizationUnitId: true },
    });
    for (const { organizationUnitId } of memberships) {
      if (!organizationUnitId) continue;
      const ancestorUnitIds =
        await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
          organizationUnitId,
        );
      if (ancestorUnitIds.includes(headerUnitId)) return;
    }
    throw new NotFoundGraphQLError(notFoundMessage);
  }

  /**
   * For resources scoped to an organization rather than a unit (e.g. roles):
   * the resource's organization must be the header unit's organization.
   */
  async assertOrganizationInScope(
    headerUnitId: string,
    resourceOrganizationId: string | null | undefined,
    notFoundMessage = 'Resource not found',
  ): Promise<void> {
    if (!resourceOrganizationId) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }

    const headerOrganizationId =
      await this.organizationUnitDataService.findOrganizationIdByUnitId(
        headerUnitId,
      );
    if (headerOrganizationId !== resourceOrganizationId) {
      throw new NotFoundGraphQLError(notFoundMessage);
    }
  }
}

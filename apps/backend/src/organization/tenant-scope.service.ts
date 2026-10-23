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
   * At least one of the units must be in scope. For resources reached through
   * several units, e.g. a volunteer through their memberships.
   */
  async assertAnyUnitInScope(
    headerUnitId: string,
    resourceUnitIds: ReadonlyArray<string | null | undefined>,
    notFoundMessage = 'Resource not found',
  ): Promise<void> {
    for (const unitId of resourceUnitIds) {
      if (!unitId) continue;
      const ancestorUnitIds =
        await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
          unitId,
        );
      if (ancestorUnitIds.includes(headerUnitId)) return;
    }
    throw new NotFoundGraphQLError(notFoundMessage);
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
    const memberships = await this.db.query.memberships.findMany({
      where: { userId },
      columns: { organizationUnitId: true },
    });
    await this.assertAnyUnitInScope(
      headerUnitId,
      memberships.map((m) => m.organizationUnitId),
      notFoundMessage,
    );
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

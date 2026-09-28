import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { RegisterLoader } from '../../graphql/interceptors';
import { OrganizationMapper } from '../../organization/mappers/organization.mapper';
import { OrganizationUnitMapper } from '../../organization/mappers/organization-unit.mapper';
import type { Organization } from '../../organization/models/organization.model';
import type { OrganizationUnit } from '../../organization/models/organization-unit.model';
import { OrganizationService } from '../../organization/organization.service';
import { OrganizationUnitService } from '../../organization/organization-unit.service';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import {
  type ResolvedOrgProfile,
  resolveOrgProfileFromUnits,
  type UnitRow,
} from '../utils/org-profile';
import { settleEach } from './settle-each';

@RegisterLoader()
@Injectable({ scope: Scope.REQUEST })
export class AccountingOrganizationLoader {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly organizationMapper: OrganizationMapper,
    private readonly organizationUnitService: OrganizationUnitService,
    private readonly organizationUnitMapper: OrganizationUnitMapper,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
  ) {}

  public readonly organizationById = new DataLoader<string, Organization>(
    (ids) =>
      settleEach(ids, async (id) => {
        const organization = await this.organizationService.findById(id);
        if (!organization) {
          throw new NotFoundGraphQLError(
            `Organization with ID ${id} not found`,
          );
        }
        return this.organizationMapper.toModelOrThrow(organization);
      }),
  );

  public readonly organizationUnitById = new DataLoader<
    string,
    OrganizationUnit | null
  >((ids) =>
    Promise.all(
      ids.map(async (id) =>
        this.organizationUnitMapper.toModel(
          await this.organizationUnitService.findById(id),
        ),
      ),
    ),
  );

  /** The org's root unit, keyed by organizationId — for templates/documents scoped to the org as a whole rather than a specific unit. */
  public readonly rootUnitByOrganizationId = new DataLoader<
    string,
    OrganizationUnit | null
  >((organizationIds) =>
    Promise.all(
      organizationIds.map(async (organizationId) =>
        this.organizationUnitMapper.toModel(
          await this.organizationService.findRootUnit(organizationId),
        ),
      ),
    ),
  );

  /**
   * A unit's resolved org details (own values, blank fields inherited from the
   * nearest live parent), keyed by unit id. Batched: one query loads every
   * requested unit, then one more per ancestor depth, instead of the per-document
   * findFirst + hop-per-ancestor traversal of `resolveOrgProfile`.
   */
  public readonly orgProfileByUnitId = new DataLoader<
    string,
    ResolvedOrgProfile | null
  >(async (unitIds) => {
    const unitsById = await this.loadUnitsWithAncestors([...unitIds]);
    return unitIds.map((id) => {
      const unit = unitsById.get(id);
      return unit ? resolveOrgProfileFromUnits(unit, unitsById) : null;
    });
  });

  /** The org root unit's resolved org details, keyed by organizationId — for documents scoped to the org as a whole. */
  public readonly orgProfileByOrganizationId = new DataLoader<
    string,
    ResolvedOrgProfile | null
  >(async (organizationIds) => {
    const roots = await Promise.all(
      organizationIds.map((id) => this.organizationService.findRootUnit(id)),
    );
    const unitsById = await this.loadUnitsWithAncestors(
      roots
        .filter((root): root is NonNullable<typeof root> => root != null)
        .map((root) => root.id),
    );
    return roots.map((root) => {
      const unit = root ? unitsById.get(root.id) : undefined;
      return unit ? resolveOrgProfileFromUnits(unit, unitsById) : null;
    });
  });

  /** Loads the seed units plus their whole ancestor chain in one query per depth. */
  private async loadUnitsWithAncestors(
    seedIds: string[],
  ): Promise<Map<string, UnitRow>> {
    const unitsById = new Map<string, UnitRow>();
    let frontier = [...new Set(seedIds)];
    while (frontier.length > 0) {
      const rows = (await this.organizationUnitDataService.findByIds(
        frontier,
      )) as UnitRow[];
      for (const row of rows) unitsById.set(row.id, row);
      const parentIds = rows
        .map((row) => row.parentId)
        .filter((id): id is string => typeof id === 'string');
      frontier = [...new Set(parentIds)].filter((id) => !unitsById.has(id));
    }
    return unitsById;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotFoundGraphQLError } from '../graphql/errors';
import type { OrganizationEntity } from './schemas/organization.schema';
import type { OrganizationUnitEntity } from './schemas/organization-unit.schema';

@Injectable()
export class OrganizationUnitDataService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async findById(id: string): Promise<OrganizationUnitEntity | undefined> {
    return this.db.query.organizationUnits.findFirst({
      where: { id },
    });
  }

  /** Many org units by id in one query (DataLoader batch). */
  async findByIds(ids: string[]): Promise<OrganizationUnitEntity[]> {
    if (ids.length === 0) return [];
    return this.db.query.organizationUnits.findMany({
      where: { id: { in: ids } },
    });
  }

  async findOrganizationIdByUnitId(
    organizationUnitId: string,
  ): Promise<string> {
    const unit = await this.db.query.organizationUnits.findFirst({
      where: { id: organizationUnitId },
      columns: { organizationId: true },
    });
    if (!unit) {
      throw new NotFoundGraphQLError('Organization unit not found');
    }
    return unit.organizationId;
  }

  async findOrganizationByUnitId(
    organizationUnitId: string,
  ): Promise<OrganizationEntity | undefined> {
    const organizationUnit = await this.findById(organizationUnitId);
    if (!organizationUnit) {
      return undefined;
    }

    return this.db.query.organizations.findFirst({
      where: { id: organizationUnit.organizationId },
    });
  }

  /**
   * The unit and every descendant, breadth-first. Loads the organization's unit
   * tree once; units cannot be re-parented through the API, and a corrupt
   * parent cycle is skipped rather than walked forever.
   */
  async listInclusiveDescendantUnitIds(
    organizationUnitId: string,
  ): Promise<string[]> {
    const organizationId =
      await this.findOrganizationIdByUnitId(organizationUnitId);
    const unitRows = await this.db.query.organizationUnits.findMany({
      where: { organizationId },
      columns: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string | null, string[]>();
    for (const unit of unitRows) {
      const children = childrenByParent.get(unit.parentId) ?? [];
      children.push(unit.id);
      childrenByParent.set(unit.parentId, children);
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [organizationUnitId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      result.push(current);
      queue.push(...(childrenByParent.get(current) ?? []));
    }

    return result;
  }

  async listInclusiveAncestorUnitIds(
    organizationUnitId: string,
  ): Promise<string[]> {
    const chain: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null = organizationUnitId;

    // A cycle should be impossible through the API (updates cannot re-parent
    // units), but walk defensively so corrupt/legacy rows cannot hang every
    // permission check that depends on this chain.
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const unit = await this.db.query.organizationUnits.findFirst({
        where: { id: currentId },
        columns: { id: true, parentId: true },
      });
      if (!unit) break;
      chain.push(unit.id);
      currentId = unit.parentId;
    }

    return chain;
  }
}

import { Inject, Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ReimbursementTypeMapper } from '../../accounting/mappers/reimbursement-type.mapper';
import type { ReimbursementType } from '../../accounting/models/reimbursement-type.model';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { RegisterLoader } from '../../graphql/interceptors';
import { OrganizationUnitMapper } from '../../organization/mappers/organization-unit.mapper';
import type { OrganizationUnit } from '../../organization/models/organization-unit.model';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import { ShiftInstanceMapper } from '../../shift/mappers/shift-instance.mapper';
import type { ShiftInstance } from '../../shift/models/shift-instance.model';
import { ShiftService } from '../../shift/shift.service';
import { UserMapper } from '../../user/mappers/user.mapper';
import type { User } from '../../user/models/user.model';

@RegisterLoader()
@Injectable({ scope: Scope.REQUEST })
export class TimeEntryLoader {
  constructor(
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly organizationUnitMapper: OrganizationUnitMapper,
    private readonly reimbursementTypeMapper: ReimbursementTypeMapper,
    private readonly userMapper: UserMapper,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly shiftService: ShiftService,
    private readonly shiftInstanceMapper: ShiftInstanceMapper,
  ) {}

  public readonly organizationUnitById = new DataLoader<
    string,
    OrganizationUnit
  >(async (unitIds) => {
    const units = await this.organizationUnitDataService.findByIds([
      ...unitIds,
    ]);
    const byId = new Map(units.map((unit) => [unit.id, unit]));

    return unitIds.map((id) => {
      const unit = byId.get(id);
      if (!unit) {
        return new NotFoundGraphQLError(
          `Organization unit with ID ${id} not found`,
        );
      }
      return this.organizationUnitMapper.toModelOrThrow(unit);
    });
  });

  public readonly reimbursementTypeById = new DataLoader<
    string,
    ReimbursementType
  >(async (ids) => {
    const types = await this.db.query.reimbursementTypes.findMany({
      where: { id: { in: [...ids] } },
    });
    const byId = new Map(types.map((type) => [type.id, type]));

    return ids.map((id) => {
      const type = byId.get(id);
      if (!type) {
        return new NotFoundGraphQLError(
          `Reimbursement type with ID ${id} not found`,
        );
      }
      return this.reimbursementTypeMapper.toModelOrThrow(type);
    });
  });

  // Intentionally not org-scoped: createdById is always the server-set acting
  // user for an already org-scoped entry, so the id is safe to resolve globally.
  public readonly userById = new DataLoader<string, User | null>(
    async (ids) => {
      const users = await this.db.query.users.findMany({
        where: { id: { in: [...ids] } },
      });
      const byId = new Map(users.map((user) => [user.id, user]));

      return ids.map((id) => {
        const user = byId.get(id);
        return user ? this.userMapper.toModelOrThrow(user) : null;
      });
    },
  );

  // Org-scoped: keys are `${organizationUnitId}:${shiftInstanceId}` so the
  // batch never leaks instances across org units within the same request.
  public readonly shiftInstanceById = new DataLoader<
    string,
    ShiftInstance | null
  >(async (compositeKeys) => {
    const grouped = new Map<string, string[]>();
    for (const key of compositeKeys) {
      const colonIdx = key.indexOf(':');
      const orgUnitId = key.slice(0, colonIdx);
      const instanceId = key.slice(colonIdx + 1);
      const ids = grouped.get(orgUnitId) ?? [];
      ids.push(instanceId);
      grouped.set(orgUnitId, ids);
    }

    const resultMap = new Map<string, ShiftInstance | null>();
    for (const [orgUnitId, ids] of grouped) {
      const instances = await this.shiftService.findInstancesByIds(
        ids,
        orgUnitId,
      );
      for (let i = 0; i < ids.length; i++) {
        const entity = instances[i];
        resultMap.set(
          `${orgUnitId}:${ids[i]}`,
          entity ? this.shiftInstanceMapper.toModelOrThrow(entity) : null,
        );
      }
    }

    return compositeKeys.map((key) => resultMap.get(key) ?? null);
  });
}

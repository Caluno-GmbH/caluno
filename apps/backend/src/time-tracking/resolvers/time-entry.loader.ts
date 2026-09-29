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
}

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import type { RequirementFormEntity } from '../../database/schema';
import * as schema from '../../database/schema';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { RequiredFormTargetType } from '../enums';
import type {
  RequiredFormRef,
  RequiredFormTargetStrategy,
} from './required-form-target.strategy';
import { RequiredFormWriteSupport } from './required-form-write-support';

@Injectable()
export class OrganizationUnitRequiredFormTargetStrategy
  implements RequiredFormTargetStrategy
{
  readonly targetType = RequiredFormTargetType.ORGANIZATION_UNIT;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly writeSupport: RequiredFormWriteSupport,
  ) {}

  async resolveOrganizationUnitId(targetId: string): Promise<string> {
    return targetId;
  }

  async getRequiredForms(targetId: string): Promise<RequiredFormRef[]> {
    const rows = await this.db.query.organizationUnitRequiredForms.findMany({
      where: { organizationUnitId: targetId },
      orderBy: { order: 'asc' },
      with: { form: true },
    });

    return rows.map((row) => ({
      // formId is a NOT NULL FK with onDelete: 'restrict', so row.form always exists.
      form: row.form as RequirementFormEntity,
      order: row.order,
    }));
  }

  async setRequiredForms(
    targetId: string,
    formIds: string[],
    userId?: string,
  ): Promise<RequiredFormRef[]> {
    const orgUnit = await this.db.query.organizationUnits.findFirst({
      where: { id: targetId },
    });

    if (!orgUnit) {
      throw new NotFoundGraphQLError('Organization unit not found');
    }

    await this.writeSupport.assertFormsBelongToOrganization(
      formIds,
      orgUnit.organizationId,
      this.db,
    );

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.organizationUnitRequiredForms)
        .where(
          eq(schema.organizationUnitRequiredForms.organizationUnitId, targetId),
        );

      if (formIds.length > 0) {
        await tx.insert(schema.organizationUnitRequiredForms).values(
          formIds.map((formId, index) => ({
            organizationUnitId: targetId,
            formId,
            order: index,
          })),
        );
      }
    });

    this.writeSupport.captureRequiredFormUpdate(userId, {
      organization_id: orgUnit.organizationId,
      organization_unit_id: targetId,
      target_type: RequiredFormTargetType.ORGANIZATION_UNIT.toLowerCase(),
    });

    return this.getRequiredForms(targetId);
  }
}

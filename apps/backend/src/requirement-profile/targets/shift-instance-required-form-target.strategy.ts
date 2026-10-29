import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import type {
  OrganizationUnitEntity,
  RequirementFormEntity,
} from '../../database/schema';
import * as schema from '../../database/schema';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { RequiredFormTargetType } from '../enums';
import type {
  RequiredFormRef,
  RequiredFormTargetStrategy,
} from './required-form-target.strategy';
import { RequiredFormWriteSupport } from './required-form-write-support';

@Injectable()
export class ShiftInstanceRequiredFormTargetStrategy
  implements RequiredFormTargetStrategy
{
  readonly targetType = RequiredFormTargetType.SHIFT_INSTANCE;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly writeSupport: RequiredFormWriteSupport,
  ) {}

  async resolveOrganizationUnitId(targetId: string): Promise<string> {
    const instance = await this.db.query.shiftInstances.findFirst({
      where: { id: targetId },
      columns: { masterId: true },
      with: { master: { columns: { organizationUnitId: true } } },
    });
    if (!instance) {
      throw new NotFoundGraphQLError('Shift instance not found');
    }
    // masterId is a NOT NULL FK, so master always exists.
    return instance.master.organizationUnitId;
  }

  async getRequiredForms(targetId: string): Promise<RequiredFormRef[]> {
    const rows = await this.db.query.shiftInstanceRequiredForms.findMany({
      where: { shiftInstanceId: targetId },
      orderBy: { order: 'asc' },
      with: { form: true },
    });

    return rows.map((row) => ({
      form: row.form as RequirementFormEntity,
      order: row.order,
    }));
  }

  async setRequiredForms(
    targetId: string,
    formIds: string[],
    userId?: string,
  ): Promise<RequiredFormRef[]> {
    const instance = await this.db.query.shiftInstances.findFirst({
      where: { id: targetId, isCancelled: false },
      with: { master: { with: { organizationUnit: true } } },
    });

    if (!instance) {
      throw new NotFoundGraphQLError('Shift instance not found');
    }

    await this.applyRequiredForms(
      targetId,
      // masterId and organizationUnitId are NOT NULL FKs, so both always exist.
      (instance.master.organizationUnit as OrganizationUnitEntity)
        .organizationId,
      formIds,
      undefined,
      userId,
    );

    return this.getRequiredForms(targetId);
  }

  async applyRequiredForms(
    targetId: string,
    organizationId: string,
    formIds: string[],
    tx?: Database,
    userId?: string,
  ): Promise<void> {
    const runner = tx ?? this.db;

    await this.writeSupport.assertFormsBelongToOrganization(
      formIds,
      organizationId,
      runner,
    );

    const write = async (writer: Database) => {
      await writer
        .delete(schema.shiftInstanceRequiredForms)
        .where(eq(schema.shiftInstanceRequiredForms.shiftInstanceId, targetId));

      if (formIds.length > 0) {
        await writer.insert(schema.shiftInstanceRequiredForms).values(
          formIds.map((formId, index) => ({
            shiftInstanceId: targetId,
            formId,
            order: index,
          })),
        );
      }
    };

    if (tx) {
      await write(tx);
    } else {
      await this.db.transaction((innerTx) => write(innerTx));
    }

    this.writeSupport.captureRequiredFormUpdate(userId, {
      organization_id: organizationId,
      target_type: RequiredFormTargetType.SHIFT_INSTANCE.toLowerCase(),
      shift_instance_id: targetId,
    });
  }
}

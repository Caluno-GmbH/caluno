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
export class ShiftRequiredFormTargetStrategy
  implements RequiredFormTargetStrategy
{
  readonly targetType = RequiredFormTargetType.SHIFT;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly writeSupport: RequiredFormWriteSupport,
  ) {}

  async resolveOrganizationUnitId(targetId: string): Promise<string> {
    const shift = await this.db.query.shifts.findFirst({
      where: { id: targetId },
      columns: { organizationUnitId: true },
    });
    if (!shift) throw new NotFoundGraphQLError('Shift not found');
    return shift.organizationUnitId;
  }

  async getRequiredForms(targetId: string): Promise<RequiredFormRef[]> {
    const rows = await this.db.query.shiftRequiredForms.findMany({
      where: { shiftId: targetId },
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
    const shift = await this.db.query.shifts.findFirst({
      where: { id: targetId, isDeleted: false },
      with: { organizationUnit: true },
    });

    if (!shift) {
      throw new NotFoundGraphQLError('Shift not found');
    }

    await this.applyRequiredForms(
      targetId,
      // organizationUnitId is a NOT NULL FK, so organizationUnit always exists.
      (shift.organizationUnit as OrganizationUnitEntity).organizationId,
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
        .delete(schema.shiftRequiredForms)
        .where(eq(schema.shiftRequiredForms.shiftId, targetId));

      if (formIds.length > 0) {
        await writer.insert(schema.shiftRequiredForms).values(
          formIds.map((formId, index) => ({
            shiftId: targetId,
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
      target_type: RequiredFormTargetType.SHIFT.toLowerCase(),
      shift_id: targetId,
    });
  }
}

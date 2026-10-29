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
export class EventRequiredFormTargetStrategy
  implements RequiredFormTargetStrategy
{
  readonly targetType = RequiredFormTargetType.EVENT;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly writeSupport: RequiredFormWriteSupport,
  ) {}

  async resolveOrganizationUnitId(targetId: string): Promise<string> {
    const event = await this.db.query.events.findFirst({
      where: { id: targetId },
      columns: { organizationUnitId: true },
    });
    if (!event) throw new NotFoundGraphQLError('Event not found');
    return event.organizationUnitId;
  }

  async getRequiredForms(targetId: string): Promise<RequiredFormRef[]> {
    const rows = await this.db.query.eventRequiredForms.findMany({
      where: { eventId: targetId },
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
    const event = await this.db.query.events.findFirst({
      where: { id: targetId, isDeleted: false },
      with: { organizationUnit: true },
    });

    if (!event) {
      throw new NotFoundGraphQLError('Event not found');
    }

    await this.applyRequiredForms(
      targetId,
      // organizationUnitId is a NOT NULL FK, so organizationUnit always exists.
      (event.organizationUnit as OrganizationUnitEntity).organizationId,
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
        .delete(schema.eventRequiredForms)
        .where(eq(schema.eventRequiredForms.eventId, targetId));

      if (formIds.length > 0) {
        await writer.insert(schema.eventRequiredForms).values(
          formIds.map((formId, index) => ({
            eventId: targetId,
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
      target_type: RequiredFormTargetType.EVENT.toLowerCase(),
      event_id: targetId,
    });
  }
}

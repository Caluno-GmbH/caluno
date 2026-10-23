import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import type { RequirementFormEntity } from '../../database/schema';
import * as schema from '../../database/schema';
import { EventInviteStatus } from '../../event/enums';
import { ConflictGraphQLError } from '../../graphql/errors';
import { ShiftInviteStatus } from '../../shift/enums';
import { RequiredFormTargetType } from '../enums';
import { RequiredFormTargetRegistry } from '../targets';

export type RequiredFormTarget = {
  targetType: RequiredFormTargetType;
  targetId: string;
};

export type RequiredFormStatus = {
  form: RequirementFormEntity;
  order: number;
  submitted: boolean;
  submissionId: string | null;
  targetType: RequiredFormTargetType;
  targetId: string;
};

@Injectable()
export class RequiredFormService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly targetRegistry: RequiredFormTargetRegistry,
  ) {}

  async getRequiredForms(
    target: RequiredFormTarget,
  ): Promise<Array<{ form: RequirementFormEntity; order: number }>> {
    return this.targetRegistry
      .get(target.targetType)
      .getRequiredForms(target.targetId);
  }

  async getRequiredFormStatuses(
    userId: string,
    target: RequiredFormTarget,
  ): Promise<RequiredFormStatus[]> {
    const requiredForms = await this.getRequiredForms(target);

    if (requiredForms.length === 0) {
      return [];
    }

    const formIds = requiredForms.map((item) => item.form.id);
    const organizationUnitId =
      await this.resolveTargetOrganizationUnitId(target);

    const submissions = await this.db.query.formSubmissions.findMany({
      where: {
        userId,
        formId: { in: formIds },
        organizationUnitId,
      },
    });

    const submissionByFormId = new Map(submissions.map((s) => [s.formId, s]));

    return requiredForms.map(({ form, order }) => {
      const submission = submissionByFormId.get(form.id);
      return {
        form,
        order,
        submitted: Boolean(submission),
        submissionId: submission?.id ?? null,
        targetType: target.targetType,
        targetId: target.targetId,
      };
    });
  }

  async resolveTargetOrganizationUnitId(
    target: RequiredFormTarget,
  ): Promise<string> {
    return this.targetRegistry
      .get(target.targetType)
      .resolveOrganizationUnitId(target.targetId);
  }

  async requiredFormsForUser(
    userId: string,
    organizationUnitId: string,
  ): Promise<RequirementFormEntity[]> {
    // 1. requested: org-unit required forms
    const orgUnitRequired = await this.getRequiredForms({
      targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
      targetId: organizationUnitId,
    });

    // 2. requested: event required forms for events the user is invited
    const pendingEventInvites = await this.db.query.eventInvites.findMany({
      where: {
        userId,
        event: { organizationUnitId },
        status: EventInviteStatus.ADMIN_INVITED,
      },
    });

    const eventIds = pendingEventInvites.map((e) => e.eventId);
    const eventsRequiredForms = await this.getRequiredFormsByEventIds(eventIds);

    // 3. requested: shift required forms for any shift intance the user is invited
    const shiftIdRows = await this.db
      .select({ masterId: schema.shiftInstances.masterId })
      .from(schema.shiftInstanceInvites)
      .innerJoin(
        schema.shiftInstances,
        eq(schema.shiftInstances.id, schema.shiftInstanceInvites.instanceId),
      )
      .innerJoin(
        schema.shifts,
        eq(schema.shifts.id, schema.shiftInstances.masterId),
      )
      .where(
        and(
          eq(schema.shiftInstanceInvites.userId, userId),
          eq(
            schema.shiftInstanceInvites.status,
            ShiftInviteStatus.ADMIN_INVITED,
          ),
          eq(schema.shiftInstances.isCancelled, false),
          eq(schema.shifts.organizationUnitId, organizationUnitId),
          eq(schema.shifts.isDeleted, false),
        ),
      )
      .groupBy(schema.shiftInstances.masterId);
    const shiftIds = shiftIdRows.map((row) => row.masterId);
    const shiftsRequiredForms = await this.getRequiredFormsByShiftIds(shiftIds);

    // 4. union of requested forms, deduped by formId
    const byForm = new Map<string, RequirementFormEntity>();
    for (const { form } of [
      ...orgUnitRequired,
      ...eventsRequiredForms,
      ...shiftsRequiredForms,
    ]) {
      byForm.set(form.id, form);
    }

    return [...byForm.values()];
  }

  async countRequiredFormsByEventIds(
    eventIds: string[],
  ): Promise<Array<{ eventId: string; count: number }>> {
    if (eventIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        eventId: schema.eventRequiredForms.eventId,
        count: count(),
      })
      .from(schema.eventRequiredForms)
      .where(inArray(schema.eventRequiredForms.eventId, eventIds))
      .groupBy(schema.eventRequiredForms.eventId);

    return rows.map((row) => ({
      eventId: row.eventId,
      count: Number(row.count),
    }));
  }

  async getRequiredFormsByEventIds(eventIds: string[]): Promise<
    Array<{
      eventId: string;
      form: RequirementFormEntity;
      order: number;
    }>
  > {
    if (eventIds.length === 0) {
      return [];
    }

    const rows = await this.db.query.eventRequiredForms.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: { order: 'asc' },
      with: { form: true },
    });

    return rows
      .map((row) => ({
        eventId: row.eventId,
        form: row.form,
        order: row.order,
      }))
      .filter(
        (
          row,
        ): row is {
          eventId: string;
          form: RequirementFormEntity;
          order: number;
        } => Boolean(row.form),
      );
  }

  async hasRequiredForms(target: RequiredFormTarget): Promise<boolean> {
    const requiredForms = await this.getRequiredForms(target);
    return requiredForms.length > 0;
  }

  async areRequiredFormsSatisfied(
    userId: string,
    target: RequiredFormTarget,
  ): Promise<boolean> {
    const statuses = await this.getRequiredFormStatuses(userId, target);

    if (statuses.length === 0) {
      return true;
    }

    return statuses.every((s) => s.submitted);
  }

  async setRequiredForms(
    target: RequiredFormTarget,
    formIds: string[],
    userId?: string,
  ): Promise<Array<{ form: RequirementFormEntity; order: number }>> {
    return this.targetRegistry
      .get(target.targetType)
      .setRequiredForms(target.targetId, formIds, userId);
  }

  // Shared by ShiftService.updateShiftInstance (single instance edits).
  async applyShiftInstanceRequiredForms(
    shiftInstanceId: string,
    organizationId: string,
    formIds: string[],
    tx?: Database,
    userId?: string,
  ): Promise<void> {
    const strategy = this.targetRegistry.get(
      RequiredFormTargetType.SHIFT_INSTANCE,
    );
    if (!strategy.applyRequiredForms) {
      throw new ConflictGraphQLError(
        `Unsupported required-form target: ${RequiredFormTargetType.SHIFT_INSTANCE}`,
      );
    }
    await strategy.applyRequiredForms(
      shiftInstanceId,
      organizationId,
      formIds,
      tx,
      userId,
    );
  }

  // Shared by the standalone setShiftRequiredForms mutation (no tx: opens
  // its own) and ShiftService.create/update (pass their surrounding tx so
  // the write commits atomically with the rest of the shift mutation).
  async applyShiftRequiredForms(
    shiftId: string,
    organizationId: string,
    formIds: string[],
    tx?: Database,
    userId?: string,
  ): Promise<void> {
    const strategy = this.targetRegistry.get(RequiredFormTargetType.SHIFT);
    if (!strategy.applyRequiredForms) {
      throw new ConflictGraphQLError(
        `Unsupported required-form target: ${RequiredFormTargetType.SHIFT}`,
      );
    }
    await strategy.applyRequiredForms(
      shiftId,
      organizationId,
      formIds,
      tx,
      userId,
    );
  }

  async countRequiredFormsByShiftIds(
    shiftIds: string[],
  ): Promise<Array<{ shiftId: string; count: number }>> {
    if (shiftIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        shiftId: schema.shiftRequiredForms.shiftId,
        count: count(),
      })
      .from(schema.shiftRequiredForms)
      .where(inArray(schema.shiftRequiredForms.shiftId, shiftIds))
      .groupBy(schema.shiftRequiredForms.shiftId);

    return rows.map((row) => ({
      shiftId: row.shiftId,
      count: Number(row.count),
    }));
  }

  async getRequiredFormsByShiftIds(shiftIds: string[]): Promise<
    Array<{
      shiftId: string;
      form: RequirementFormEntity;
      order: number;
    }>
  > {
    if (shiftIds.length === 0) {
      return [];
    }

    const rows = await this.db.query.shiftRequiredForms.findMany({
      where: { shiftId: { in: shiftIds } },
      orderBy: { order: 'asc' },
      with: { form: true },
    });

    return rows
      .map((row) => ({
        shiftId: row.shiftId,
        form: row.form,
        order: row.order,
      }))
      .filter(
        (
          row,
        ): row is {
          shiftId: string;
          form: RequirementFormEntity;
          order: number;
        } => Boolean(row.form),
      );
  }

  // Shared by the standalone setEventRequiredForms mutation (no tx: opens
  // its own) and EventService.create/update (pass their surrounding tx so
  // the write commits atomically with the rest of the event mutation).
  async applyEventRequiredForms(
    eventId: string,
    organizationId: string,
    formIds: string[],
    tx?: Database,
    userId?: string,
  ): Promise<void> {
    const strategy = this.targetRegistry.get(RequiredFormTargetType.EVENT);
    if (!strategy.applyRequiredForms) {
      throw new ConflictGraphQLError(
        `Unsupported required-form target: ${RequiredFormTargetType.EVENT}`,
      );
    }
    await strategy.applyRequiredForms(
      eventId,
      organizationId,
      formIds,
      tx,
      userId,
    );
  }

  async countRequiredFormsByShiftInstanceIds(
    shiftInstanceIds: string[],
  ): Promise<Array<{ shiftInstanceId: string; count: number }>> {
    if (shiftInstanceIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        shiftInstanceId: schema.shiftInstanceRequiredForms.shiftInstanceId,
        count: count(),
      })
      .from(schema.shiftInstanceRequiredForms)
      .where(
        inArray(
          schema.shiftInstanceRequiredForms.shiftInstanceId,
          shiftInstanceIds,
        ),
      )
      .groupBy(schema.shiftInstanceRequiredForms.shiftInstanceId);

    return rows.map((row) => ({
      shiftInstanceId: row.shiftInstanceId,
      count: Number(row.count),
    }));
  }

  async getRequiredFormsByShiftInstanceIds(shiftInstanceIds: string[]): Promise<
    Array<{
      shiftInstanceId: string;
      form: RequirementFormEntity;
      order: number;
    }>
  > {
    if (shiftInstanceIds.length === 0) {
      return [];
    }

    const rows = await this.db.query.shiftInstanceRequiredForms.findMany({
      where: { shiftInstanceId: { in: shiftInstanceIds } },
      orderBy: { order: 'asc' },
      with: { form: true },
    });

    return rows.map((row) => ({
      shiftInstanceId: row.shiftInstanceId,
      // formId is a NOT NULL FK with onDelete: 'restrict', so row.form always exists.
      form: row.form as RequirementFormEntity,
      order: row.order,
    }));
  }

  async isFormRequiredByAnyTarget(formId: string): Promise<boolean> {
    const attachments = await this.listFormAttachments(formId);
    return attachments.length > 0;
  }

  async listFormAttachments(formId: string): Promise<
    Array<{
      targetType: RequiredFormTargetType;
      targetId: string;
      name: string;
    }>
  > {
    const attachments: Array<{
      targetType: RequiredFormTargetType;
      targetId: string;
      name: string;
    }> = [];

    const orgUnitRows =
      await this.db.query.organizationUnitRequiredForms.findMany({
        where: { formId },
        with: { organizationUnit: { columns: { id: true, name: true } } },
      });
    for (const row of orgUnitRows) {
      attachments.push({
        targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
        targetId: row.organizationUnitId,
        name: row.organizationUnit.name,
      });
    }

    const eventRows = await this.db.query.eventRequiredForms.findMany({
      where: { formId },
      with: { event: { columns: { id: true, title: true } } },
    });
    for (const row of eventRows) {
      attachments.push({
        targetType: RequiredFormTargetType.EVENT,
        targetId: row.eventId,
        name: row.event.title,
      });
    }

    const shiftRows = await this.db.query.shiftRequiredForms.findMany({
      where: { formId },
      with: { shift: { columns: { id: true, title: true } } },
    });
    for (const row of shiftRows) {
      attachments.push({
        targetType: RequiredFormTargetType.SHIFT,
        targetId: row.shiftId,
        name: row.shift.title,
      });
    }

    const shiftInstanceRows =
      await this.db.query.shiftInstanceRequiredForms.findMany({
        where: { formId },
        with: {
          shiftInstance: {
            columns: {
              id: true,
              overrideTitle: true,
              actualStartsAt: true,
            },
            with: { master: { columns: { title: true } } },
          },
        },
      });
    for (const row of shiftInstanceRows) {
      const instance = row.shiftInstance;
      if (!instance) continue;
      const title = instance.overrideTitle ?? instance.master.title;
      attachments.push({
        targetType: RequiredFormTargetType.SHIFT_INSTANCE,
        targetId: row.shiftInstanceId,
        name: `${title} (${instance.actualStartsAt.toISOString()})`,
      });
    }

    return attachments;
  }

  async detachFormFromAllTargets(
    formId: string,
    runner: Pick<Database, 'delete'> = this.db,
  ): Promise<void> {
    await runner
      .delete(schema.organizationUnitRequiredForms)
      .where(eq(schema.organizationUnitRequiredForms.formId, formId));
    await runner
      .delete(schema.eventRequiredForms)
      .where(eq(schema.eventRequiredForms.formId, formId));
    await runner
      .delete(schema.shiftRequiredForms)
      .where(eq(schema.shiftRequiredForms.formId, formId));
    await runner
      .delete(schema.shiftInstanceRequiredForms)
      .where(eq(schema.shiftInstanceRequiredForms.formId, formId));
  }
}

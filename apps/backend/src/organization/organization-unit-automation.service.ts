import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { BadRequestGraphQLError } from '../graphql/errors';
import { NotFoundGraphQLError } from '../graphql/errors/not-found.error';
import { ALL_WEEKDAYS, type Weekday } from '../shared/enums/weekday.enum';
import {
  ALL_ORGANIZATION_UNIT_AUTOMATION_KINDS,
  OrganizationUnitAutomationKind,
} from './enums';
import {
  type AutomationRow,
  automationRowKey,
  type ResolvedAutomation,
  resolveAutomation,
} from './utils/automation-resolution';
import {
  AUTOMATION_LEAD_TIME_HOURS,
  AUTOMATION_SEND_AT_TIME_PATTERN,
  AUTOMATION_SPECS,
  normalizeAutomationSettings,
  normalizeSendAtTime,
} from './utils/automation-settings';

export interface AutomationPatch {
  enabled?: boolean;
  activeDays?: Weekday[];
  leadTimeHours?: number | null;
  sendAtTime?: string | null;
}

@Injectable()
export class OrganizationUnitAutomationService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async findByUnitId(
    organizationUnitId: string,
  ): Promise<ResolvedAutomation[]> {
    const rowsByKey = await this.loadRows([organizationUnitId]);

    return ALL_ORGANIZATION_UNIT_AUTOMATION_KINDS.map((kind) =>
      resolveAutomation(organizationUnitId, kind, rowsByKey),
    );
  }

  async resolve(
    organizationUnitId: string,
    kind: OrganizationUnitAutomationKind,
  ): Promise<ResolvedAutomation> {
    const rowsByKey = await this.loadRows([organizationUnitId]);
    return resolveAutomation(organizationUnitId, kind, rowsByKey);
  }

  async resolveMany(
    organizationUnitIds: string[],
    kind: OrganizationUnitAutomationKind,
  ): Promise<Map<string, ResolvedAutomation>> {
    const uniqueIds = [...new Set(organizationUnitIds)];
    if (uniqueIds.length === 0) return new Map();

    const rowsByKey = await this.loadRows(uniqueIds);

    return new Map(
      uniqueIds.map((unitId) => [
        unitId,
        resolveAutomation(unitId, kind, rowsByKey),
      ]),
    );
  }

  async update(
    organizationUnitId: string,
    kind: OrganizationUnitAutomationKind,
    patch: AutomationPatch,
  ): Promise<ResolvedAutomation> {
    this.assertValidPatch(kind, patch);

    const unit = await this.db.query.organizationUnits.findFirst({
      where: { id: organizationUnitId },
      columns: { id: true },
    });
    if (!unit) {
      throw new NotFoundGraphQLError(
        `Organization unit ${organizationUnitId} not found`,
      );
    }

    const current = await this.resolve(organizationUnitId, kind);
    const merged = normalizeAutomationSettings(kind, {
      enabled: patch.enabled ?? current.enabled,
      activeDays: patch.activeDays ?? current.activeDays,
      leadTimeHours:
        patch.leadTimeHours !== undefined
          ? patch.leadTimeHours
          : current.leadTimeHours,
      sendAtTime:
        patch.sendAtTime !== undefined ? patch.sendAtTime : current.sendAtTime,
    });

    await this.db
      .insert(schema.organizationUnitAutomations)
      .values({ organizationUnitId, kind, ...merged })
      .onConflictDoUpdate({
        target: [
          schema.organizationUnitAutomations.organizationUnitId,
          schema.organizationUnitAutomations.kind,
        ],
        set: merged,
      });

    return this.resolve(organizationUnitId, kind);
  }

  private assertValidPatch(
    kind: OrganizationUnitAutomationKind,
    patch: AutomationPatch,
  ): void {
    const spec = AUTOMATION_SPECS[kind];

    if (patch.leadTimeHours !== undefined && !spec.usesLeadTimeHours) {
      throw new BadRequestGraphQLError(
        `${kind} does not take a lead time in hours`,
      );
    }
    if (patch.sendAtTime !== undefined && !spec.usesSendAtTime) {
      throw new BadRequestGraphQLError(`${kind} does not take a send time`);
    }
    if (
      patch.leadTimeHours != null &&
      !AUTOMATION_LEAD_TIME_HOURS.includes(
        patch.leadTimeHours as (typeof AUTOMATION_LEAD_TIME_HOURS)[number],
      )
    ) {
      throw new BadRequestGraphQLError(
        `Lead time must be one of ${AUTOMATION_LEAD_TIME_HOURS.join(', ')} hours`,
      );
    }
    if (spec.usesLeadTimeHours && patch.leadTimeHours === null) {
      throw new BadRequestGraphQLError(`${kind} requires a lead time in hours`);
    }
    if (spec.usesSendAtTime && patch.sendAtTime === null) {
      throw new BadRequestGraphQLError(`${kind} requires a send time`);
    }
    if (
      patch.sendAtTime != null &&
      !AUTOMATION_SEND_AT_TIME_PATTERN.test(patch.sendAtTime)
    ) {
      throw new BadRequestGraphQLError(
        `Send time must be in HH:MM format, got "${patch.sendAtTime}"`,
      );
    }
    if (patch.activeDays) {
      const invalid = patch.activeDays.filter(
        (day) => !ALL_WEEKDAYS.includes(day),
      );
      if (invalid.length > 0) {
        throw new BadRequestGraphQLError(
          `Unknown weekdays: ${invalid.join(', ')}`,
        );
      }
    }
  }

  private async loadRows(
    organizationUnitIds: string[],
  ): Promise<Map<string, AutomationRow>> {
    if (organizationUnitIds.length === 0) return new Map();

    const rows = await this.db
      .select()
      .from(schema.organizationUnitAutomations)
      .where(
        inArray(
          schema.organizationUnitAutomations.organizationUnitId,
          organizationUnitIds,
        ),
      );

    return new Map(
      rows.map((row) => [
        automationRowKey(row.organizationUnitId, row.kind),
        {
          organizationUnitId: row.organizationUnitId,
          kind: row.kind,
          enabled: row.enabled,
          activeDays: row.activeDays,
          leadTimeHours: row.leadTimeHours,
          sendAtTime: normalizeSendAtTime(row.sendAtTime),
        },
      ]),
    );
  }
}

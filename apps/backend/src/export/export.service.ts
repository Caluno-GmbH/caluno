import { Inject, Injectable } from '@nestjs/common';
import type { UserEntity } from '../auth/schemas/auth.schema';
import type { RoleEntity } from '../auth/schemas/role.schema';
import type { Database } from '../database/database.module';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { MembershipService } from '../membership/membership.service';
import type { MembershipEntity } from '../membership/schemas/membership.schema';
import { PARTICIPATING_SHIFT_INVITE_STATUSES } from '../shared/invite-status';
import type { ShiftEntity } from '../shift/schemas/shift.schema';
import type { ShiftInstanceEntity } from '../shift/schemas/shift-instance.schema';
import { ShiftService } from '../shift/shift.service';
import { TimeTrackingService } from '../time-tracking/time-tracking.service';
import { deriveTimeEntryStatus } from '../time-tracking/utils/time-entry-status';
import { ExportTable } from './enums';
import { EXPORT_TIME_ZONE } from './export-csv.util';
import { ExportLogService } from './export-log.service';
import {
  type ShiftExportRow,
  serializeShiftExport,
} from './serializers/shifts-export.serializer';
import {
  serializeTimesheetExport,
  type TimesheetExportRow,
} from './serializers/timesheets-export.serializer';
import {
  serializeUserExport,
  type UserExportRow,
} from './serializers/users-export.serializer';

export interface GenerateExportInput {
  tableKind: ExportTable;
  organizationUnitId: string;
  rowIds: string[];
  columns: string[];
  includeTechnicalIds: boolean;
  actorUserId: string;
}

type CollectedExport = {
  content: string;
  subjectUserIds: string[];
  rowCount: number;
};

type MembershipWithRelations = MembershipEntity & {
  user: UserEntity;
  roles: Array<{ role: RoleEntity | null }>;
};

type InstanceWithMaster = ShiftInstanceEntity & { master: ShiftEntity };

@Injectable()
export class ExportService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly timeTrackingService: TimeTrackingService,
    private readonly membershipService: MembershipService,
    private readonly shiftService: ShiftService,
    private readonly exportLogService: ExportLogService,
  ) {}

  async generateExport(
    input: GenerateExportInput,
  ): Promise<{ filename: string; content: string }> {
    const collected = await this.collect(input);

    await this.exportLogService.recordExport({
      organizationUnitId: input.organizationUnitId,
      actorUserId: input.actorUserId,
      tableKind: input.tableKind,
      columns: input.columns,
      includedTechnicalIds: input.includeTechnicalIds,
      rowCount: collected.rowCount,
      subjectUserIds: collected.subjectUserIds,
    });

    const orgUnit = await this.db.query.organizationUnits.findFirst({
      where: { id: input.organizationUnitId },
      columns: { name: true },
    });
    const orgSegment = fileSafeSegment(orgUnit?.name);

    return {
      filename: `${input.tableKind.toLowerCase()}-${orgSegment}-export-${berlinStamp()}.csv`,
      content: collected.content,
    };
  }

  private async collect(input: GenerateExportInput): Promise<CollectedExport> {
    switch (input.tableKind) {
      case ExportTable.TIMESHEETS:
        return this.collectTimesheets(input);
      case ExportTable.USERS:
        return this.collectUsers(input);
      case ExportTable.SHIFTS:
        return this.collectShifts(input);
    }
  }

  private async collectTimesheets(
    input: GenerateExportInput,
  ): Promise<CollectedExport> {
    const { organizationUnitId, columns, includeTechnicalIds } = input;

    const entries = await Promise.all(
      input.rowIds.map(async (id) => {
        try {
          return await this.timeTrackingService.findById(
            id,
            organizationUnitId,
          );
        } catch {
          // Foreign / not-found ids are dropped.
          return null;
        }
      }),
    );
    const present = entries.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );

    const userIds = [
      ...new Set(
        present.flatMap((e) =>
          e.createdById ? [e.volunteerId, e.createdById] : [e.volunteerId],
        ),
      ),
    ];
    const instanceIds = [
      ...new Set(
        present
          .map((e) => e.shiftInstanceId)
          .filter((id): id is string => id !== null),
      ),
    ];

    const [users, instances] = await Promise.all([
      userIds.length
        ? this.db.query.users.findMany({ where: { id: { in: userIds } } })
        : Promise.resolve<UserEntity[]>([]),
      instanceIds.length
        ? (this.db.query.shiftInstances.findMany({
            where: { id: { in: instanceIds } },
            with: { master: true },
          }) as Promise<InstanceWithMaster[]>)
        : Promise.resolve<InstanceWithMaster[]>([]),
    ]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const instancesById = new Map(instances.map((i) => [i.id, i]));

    const rows: TimesheetExportRow[] = present.map((entry) => {
      const volunteer = usersById.get(entry.volunteerId);
      const instance = entry.shiftInstanceId
        ? instancesById.get(entry.shiftInstanceId)
        : undefined;
      const createdBy = entry.createdById
        ? usersById.get(entry.createdById)
        : undefined;
      return {
        id: entry.id,
        volunteerName: volunteer?.name,
        volunteerEmail: volunteer?.email,
        shift: instance?.master.title,
        assignment: instance?.overrideTitle ?? null,
        location: instance?.overrideLocation ?? instance?.master.location,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationMinutes: durationMinutes(entry.startedAt, entry.endedAt),
        status: deriveTimeEntryStatus(entry),
        createdBy: createdBy?.name,
        notes: entry.notes,
      };
    });

    return {
      content: serializeTimesheetExport(rows, columns, includeTechnicalIds),
      subjectUserIds: [...new Set(present.map((e) => e.volunteerId))],
      rowCount: rows.length,
    };
  }

  private async collectUsers(
    input: GenerateExportInput,
  ): Promise<CollectedExport> {
    const { organizationUnitId, columns, includeTechnicalIds } = input;
    const selected = new Set(input.rowIds);

    // Org-scoped read: foreign-unit membership ids are inherently absent.
    const memberships = (
      (await this.membershipService.getMemberships(
        organizationUnitId,
      )) as MembershipWithRelations[]
    ).filter((m) => selected.has(m.id));

    const rows: UserExportRow[] = memberships.map((membership) => {
      const user = membership.user;
      const roles = (membership.roles ?? [])
        .map((mr) => mr.role?.name)
        .filter((name): name is string => Boolean(name));
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        roles,
        dateOfBirth: parseDate(user.birthdate),
        gender: user.gender,
        phone: user.phone,
        address: formatAddress(user),
      };
    });

    return {
      content: serializeUserExport(rows, columns, includeTechnicalIds),
      subjectUserIds: [...new Set(memberships.map((m) => m.user.id))],
      rowCount: rows.length,
    };
  }

  private async collectShifts(
    input: GenerateExportInput,
  ): Promise<CollectedExport> {
    const { organizationUnitId, columns, includeTechnicalIds } = input;

    // findByIds is NOT org-scoped — filter to the unit ourselves.
    const shifts = (await this.shiftService.findByIds(input.rowIds)).filter(
      (s) => s.organizationUnitId === organizationUnitId,
    );

    const instancesByMaster = await this.shiftService.findInstancesByMasterIds(
      shifts.map((s) => s.id),
      organizationUnitId,
    );

    const instanceIds = [...instancesByMaster.values()].flat().map((i) => i.id);
    const invites = instanceIds.length
      ? await this.shiftService.findInstanceInvitesByInstanceIds(
          instanceIds,
          organizationUnitId,
          PARTICIPATING_SHIFT_INVITE_STATUSES,
        )
      : [];

    const participatingByInstance = new Map<string, number>();
    for (const invite of invites) {
      participatingByInstance.set(
        invite.instanceId,
        (participatingByInstance.get(invite.instanceId) ?? 0) + 1,
      );
    }

    const rows: ShiftExportRow[] = shifts.map((shift) => {
      const instances = instancesByMaster.get(shift.id) ?? [];
      const firstDate =
        instances.length > 0
          ? instances.reduce((earliest, inst) =>
              inst.actualStartsAt < earliest.actualStartsAt ? inst : earliest,
            ).actualStartsAt
          : shift.originalStartsAt;
      const filled = instances.reduce(
        (sum, inst) => sum + (participatingByInstance.get(inst.id) ?? 0),
        0,
      );
      return {
        id: shift.id,
        title: shift.title,
        firstDate,
        location: shift.location,
        visibility: shift.visibility,
        staffing: formatStaffing(filled, shift.maxVolunteers),
      };
    });

    return {
      content: serializeShiftExport(rows, columns, includeTechnicalIds),
      subjectUserIds: [...new Set(invites.map((i) => i.userId))],
      rowCount: rows.length,
    };
  }
}

function fileSafeSegment(name: string | null | undefined): string {
  const segment = (name ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return segment || 'org';
}

function berlinStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}`;
}

function durationMinutes(startedAt: Date, endedAt: Date | null): number | null {
  if (!endedAt) return null;
  return Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAddress(user: {
  street: string | null;
  zip: string | null;
  city: string | null;
}): string | null {
  const parts = [user.street, [user.zip, user.city].filter(Boolean).join(' ')]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatStaffing(filled: number, max: number | null): string {
  return max != null ? `${filled}/${max}` : String(filled);
}

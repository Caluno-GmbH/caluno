import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import { ShiftService } from '../../shift/shift.service';
import { TimeTrackingService } from '../../time-tracking/time-tracking.service';
import { deriveTimeEntryStatus } from '../../time-tracking/utils/time-entry-status';
import { UserService } from '../../user/user.service';
import { ExportTable } from '../enums';
import { formatBerlinDateTime } from '../export-csv.util';
import type { ExportColumnDefinition } from '../serializers/export-serializer';
import type {
  CollectedExport,
  ExportCollector,
  ExportCollectorContext,
} from './export-collector';

const COLUMNS: readonly ExportColumnDefinition[] = [
  { id: 'volunteerName', label: 'Volunteer Name' },
  { id: 'volunteerEmail', label: 'Volunteer Email' },
  { id: 'shift', label: 'Shift' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'location', label: 'Location' },
  { id: 'startedAt', label: 'Started At' },
  { id: 'endedAt', label: 'Ended At' },
  { id: 'duration', label: 'Duration (min)' },
  { id: 'status', label: 'Status' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'notes', label: 'Notes' },
];

function durationMinutes(startedAt: Date, endedAt: Date | null): number | null {
  if (!endedAt) return null;
  return Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
}

@Injectable()
export class TimesheetsExportCollector implements ExportCollector {
  readonly tableKind = ExportTable.TIMESHEETS;
  readonly requiredPermission = PERMISSIONS.SHIFT_EDIT;
  readonly technicalIdLabel = 'ID';
  readonly columns = COLUMNS;

  constructor(
    private readonly timeTrackingService: TimeTrackingService,
    private readonly shiftService: ShiftService,
    private readonly userService: UserService,
  ) {}

  async collect(context: ExportCollectorContext): Promise<CollectedExport> {
    const entries = context.rowIds.length
      ? await this.timeTrackingService.findManyByIdsInUnits(
          context.rowIds,
          context.unitIds,
        )
      : [];
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    const selected = context.rowIds.flatMap((id) => {
      const entry = entriesById.get(id);
      return entry ? [entry] : [];
    });

    const userIds = [
      ...new Set(
        selected.flatMap((entry) =>
          entry.createdById
            ? [entry.volunteerId, entry.createdById]
            : [entry.volunteerId],
        ),
      ),
    ];
    const instanceIds = [
      ...new Set(
        selected
          .map((entry) => entry.shiftInstanceId)
          .filter((id): id is string => id !== null),
      ),
    ];

    const [users, instances] = await Promise.all([
      this.userService.findByIds(userIds),
      this.shiftService.findInstancesByIds(instanceIds, context.unitIds),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const instancesById = new Map<
      string,
      NonNullable<(typeof instances)[number]>
    >();
    for (const instance of instances) {
      if (instance) instancesById.set(instance.id, instance);
    }

    return {
      rows: selected.map((entry) => {
        const volunteer = usersById.get(entry.volunteerId);
        const instance = entry.shiftInstanceId
          ? instancesById.get(entry.shiftInstanceId)
          : undefined;
        const createdBy = entry.createdById
          ? usersById.get(entry.createdById)
          : undefined;
        return {
          technicalId: entry.id,
          cells: {
            volunteerName: volunteer?.name,
            volunteerEmail: volunteer?.email,
            shift: instance?.master.title,
            assignment: instance?.overrideTitle ?? null,
            location: instance?.overrideLocation ?? instance?.master.location,
            startedAt: formatBerlinDateTime(entry.startedAt),
            endedAt: formatBerlinDateTime(entry.endedAt),
            duration: durationMinutes(entry.startedAt, entry.endedAt),
            status: deriveTimeEntryStatus(entry),
            createdBy: createdBy?.name,
            notes: entry.notes,
          },
        };
      }),
      subjectUserIds: [...new Set(selected.map((entry) => entry.volunteerId))],
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import { ShiftService } from '../../shift/shift.service';
import { TimeTrackingService } from '../../time-tracking/time-tracking.service';
import { deriveTimeEntryStatus } from '../../time-tracking/utils/time-entry-status';
import { UserService } from '../../user/user.service';
import { ExportTable } from '../enums';
import { formatBerlinDate, formatBerlinDateTime } from '../export-csv.util';
import type { ExportColumnDefinition } from '../serializers/export-serializer';
import type {
  CollectedExport,
  ExportCollector,
  ExportCollectorContext,
} from './export-collector';

export const EXTENDED_PERSONAL_COLUMNS: ReadonlySet<string> = new Set([
  'volunteerDateOfBirth',
  'volunteerGender',
  'volunteerPhone',
  'volunteerAddress',
]);

const COLUMNS: readonly ExportColumnDefinition[] = [
  { id: 'volunteerName', label: 'Volunteer Name' },
  { id: 'volunteerEmail', label: 'Volunteer Email' },
  { id: 'volunteerDateOfBirth', label: 'Volunteer Date of Birth' },
  { id: 'volunteerGender', label: 'Volunteer Gender' },
  { id: 'volunteerPhone', label: 'Volunteer Phone' },
  { id: 'volunteerAddress', label: 'Volunteer Address' },
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

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAddress(
  user:
    | {
        street: string | null;
        zip: string | null;
        city: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!user) return null;
  const parts = [user.street, [user.zip, user.city].filter(Boolean).join(' ')]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

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
            volunteerDateOfBirth: formatBerlinDate(
              parseDate(volunteer?.birthdate),
            ),
            volunteerGender: volunteer?.gender,
            volunteerPhone: volunteer?.phone,
            volunteerAddress: formatAddress(volunteer),
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

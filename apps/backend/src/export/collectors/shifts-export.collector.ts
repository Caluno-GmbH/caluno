import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import { PARTICIPATING_SHIFT_INVITE_STATUSES } from '../../shared/invite-status';
import type { ShiftEntity } from '../../shift/schemas/shift.schema';
import type { ShiftInstanceEntity } from '../../shift/schemas/shift-instance.schema';
import { ShiftService } from '../../shift/shift.service';
import { ExportTable } from '../enums';
import { formatBerlinDateTime } from '../export-csv.util';
import type { ExportColumnDefinition } from '../serializers/export-serializer';
import type {
  CollectedExport,
  ExportCollector,
  ExportCollectorContext,
} from './export-collector';

const COLUMNS: readonly ExportColumnDefinition[] = [
  { id: 'title', label: 'Title', labelKey: 'export.columns.shifts.title' },
  { id: 'date', label: 'Date', labelKey: 'export.columns.shifts.date' },
  {
    id: 'location',
    label: 'Location',
    labelKey: 'export.columns.shifts.location',
  },
  {
    id: 'visibility',
    label: 'Visibility',
    labelKey: 'export.columns.shifts.visibility',
  },
  {
    id: 'staffing',
    label: 'Staffing',
    labelKey: 'export.columns.shifts.staffing',
  },
];

type InstanceWithMaster = ShiftInstanceEntity & { master: ShiftEntity };

function formatStaffing(filled: number, max: number | null): string {
  return max != null ? `${filled}/${max}` : String(filled);
}

@Injectable()
export class ShiftsExportCollector implements ExportCollector {
  readonly tableKind = ExportTable.SHIFTS;
  readonly requiredPermission = PERMISSIONS.SHIFT_EDIT;
  readonly technicalIdLabel = 'ID';
  readonly technicalIdLabelKey = 'export.technicalIds.shifts';
  readonly columns = COLUMNS;

  constructor(private readonly shiftService: ShiftService) {}

  async collect(context: ExportCollectorContext): Promise<CollectedExport> {
    // rowIds are shift instance (occurrence) ids — one export row per
    // occurrence, mirroring the table. findInstancesByIds is unit-scoped;
    // foreign/missing ids are dropped.
    const instances = (
      await this.shiftService.findInstancesByIds(
        context.rowIds,
        context.unitIds,
      )
    ).filter((instance): instance is InstanceWithMaster => instance !== null);

    const instanceIds = instances.map((instance) => instance.id);
    const invites = instanceIds.length
      ? await this.shiftService.findInstanceInvitesByInstanceIds(
          instanceIds,
          context.unitIds,
          PARTICIPATING_SHIFT_INVITE_STATUSES,
        )
      : [];

    const filledByInstance = new Map<string, number>();
    for (const invite of invites) {
      filledByInstance.set(
        invite.instanceId,
        (filledByInstance.get(invite.instanceId) ?? 0) + 1,
      );
    }

    return {
      rows: instances.map((instance) => {
        const { master } = instance;
        const maxVolunteers =
          instance.overrideMaxVolunteers ?? master.maxVolunteers;
        return {
          technicalId: instance.id,
          cells: {
            title: instance.overrideTitle ?? master.title,
            date: formatBerlinDateTime(instance.actualStartsAt),
            location: instance.overrideLocation ?? master.location,
            visibility: master.visibility,
            staffing: formatStaffing(
              filledByInstance.get(instance.id) ?? 0,
              maxVolunteers,
            ),
          },
        };
      }),
      subjectUserIds: [...new Set(invites.map((invite) => invite.userId))],
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import { PARTICIPATING_SHIFT_INVITE_STATUSES } from '../../shared/invite-status';
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
  { id: 'title', label: 'Title' },
  { id: 'date', label: 'Date' },
  { id: 'location', label: 'Location' },
  { id: 'visibility', label: 'Visibility' },
  { id: 'staffing', label: 'Staffing' },
];

function formatStaffing(filled: number, max: number | null): string {
  return max != null ? `${filled}/${max}` : String(filled);
}

@Injectable()
export class ShiftsExportCollector implements ExportCollector {
  readonly tableKind = ExportTable.SHIFTS;
  readonly requiredPermission = PERMISSIONS.SHIFT_EDIT;
  readonly technicalIdLabel = 'ID';
  readonly columns = COLUMNS;

  constructor(private readonly shiftService: ShiftService) {}

  async collect(context: ExportCollectorContext): Promise<CollectedExport> {
    const shifts = await this.shiftService.findByIdsInUnits(
      context.rowIds,
      context.unitIds,
    );
    const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));
    const selected = context.rowIds.flatMap((id) => {
      const shift = shiftsById.get(id);
      return shift ? [shift] : [];
    });

    const instancesByMaster = await this.shiftService.findInstancesByMasterIds(
      selected.map((shift) => shift.id),
      context.unitIds,
    );

    const instanceIds = [...instancesByMaster.values()]
      .flat()
      .map((instance) => instance.id);
    const invites = instanceIds.length
      ? await this.shiftService.findInstanceInvitesByInstanceIds(
          instanceIds,
          context.unitIds,
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

    return {
      rows: selected.map((shift) => {
        const instances = instancesByMaster.get(shift.id) ?? [];
        const firstDate =
          instances.length > 0
            ? instances.reduce((earliest, instance) =>
                instance.actualStartsAt < earliest.actualStartsAt
                  ? instance
                  : earliest,
              ).actualStartsAt
            : shift.originalStartsAt;
        const filled = instances.reduce(
          (sum, instance) =>
            sum + (participatingByInstance.get(instance.id) ?? 0),
          0,
        );
        return {
          technicalId: shift.id,
          cells: {
            title: shift.title,
            date: formatBerlinDateTime(firstDate),
            location: shift.location,
            visibility: shift.visibility,
            staffing: formatStaffing(filled, shift.maxVolunteers),
          },
        };
      }),
      subjectUserIds: [...new Set(invites.map((invite) => invite.userId))],
    };
  }
}

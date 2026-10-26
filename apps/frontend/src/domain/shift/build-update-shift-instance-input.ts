import { ShiftVisibility } from '@repo/data';

/**
 * Master-level fields for updateShiftInstance.
 *
 * Visibility lives on the shift master. The backend updates the master for
 * one-off shifts (rrule === null) even when applyToAllFuture is false, and
 * the edit UI exposes the open/closed toggle in that case — so visibility
 * must always be sent. rrule only applies when editing the series.
 */
export function buildUpdateShiftInstanceSeriesFields(params: {
  openShift?: boolean;
  applyToAllFuture: boolean;
  rrule?: string | null;
}): {
  visibility: ShiftVisibility;
  rrule?: string | null;
} {
  return {
    visibility: params.openShift
      ? ShiftVisibility.AllMembers
      : ShiftVisibility.InvitedMembers,
    ...(params.applyToAllFuture ? { rrule: params.rrule } : {}),
  };
}

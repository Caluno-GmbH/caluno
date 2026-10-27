import type { ShiftMasterRow } from '../components/shifts-table';
import { getStaffingState, type StaffingState } from '../staffing';

export type ShiftFillValue = '' | 'below' | 'ok' | 'full';

const FILL_TO_STATE: Record<'below' | 'ok' | 'full', StaffingState> = {
  below: 'alert',
  ok: 'neutral',
  full: 'full',
};

export function applyFillFilter(
  masters: ShiftMasterRow[],
  fill: ShiftFillValue,
): ShiftMasterRow[] {
  if (fill === '') return masters;

  const target = FILL_TO_STATE[fill];
  const matches = (inst: {
    filledCount: number;
    resolvedMin: number | null;
    resolvedMax: number | null;
  }) =>
    getStaffingState(inst.filledCount, inst.resolvedMin, inst.resolvedMax) ===
    target;
  const result: ShiftMasterRow[] = [];

  for (const master of masters) {
    // A one-off has no sub-rows: match on its single instance, keep as-is.
    if (master.singleInstance) {
      if (matches(master.singleInstance)) {
        result.push(master);
      }
      continue;
    }
    const filtered = master.subRows.filter(matches);
    if (filtered.length > 0) {
      result.push({ ...master, subRows: filtered });
    }
  }

  return result;
}

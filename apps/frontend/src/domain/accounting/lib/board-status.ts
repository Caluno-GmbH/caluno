import type { DocStatus } from './board-types';

type ActionKey = 'create' | 'countersign';

interface StatusMeta {
  labelKey: string;
  actionKey: ActionKey | null;
  isYourAction: boolean;
}

export const STATUS_META: Record<DocStatus, StatusMeta> = {
  'contract-generate': {
    labelKey: 'contractGenerate',
    actionKey: 'create',
    isYourAction: true,
  },
  'contract-draft': {
    labelKey: 'contractDraft',
    actionKey: 'create',
    isYourAction: true,
  },
  'contract-signing-vol': {
    labelKey: 'contractSigningVol',
    actionKey: null,
    isYourAction: false,
  },
  'contract-signing-coord': {
    labelKey: 'contractSigningCoord',
    actionKey: 'countersign',
    isYourAction: true,
  },
  'contract-active': {
    labelKey: 'contractActive',
    actionKey: null,
    isYourAction: false,
  },
  // A completed contract whose period has ended. Renewal is queued as its own
  // contract-generate row, so this one has no action of its own.
  'contract-expired': {
    labelKey: 'contractExpired',
    actionKey: null,
    isYourAction: false,
  },
  'contract-missing': {
    labelKey: 'contractMissing',
    actionKey: 'create',
    // false, not true: this keeps the row muted (bg-muted/20, see the
    // isYourAction check below) per the "at least in muted state" rule —
    // it still renders a Create button via actionKey, just outside the
    // normal actionable-count/sort weighting.
    isYourAction: false,
  },
  'timesheet-generate': {
    labelKey: 'timesheetGenerate',
    actionKey: 'create',
    isYourAction: true,
  },
  'timesheet-signing-vol': {
    labelKey: 'timesheetSigningVol',
    actionKey: null,
    isYourAction: false,
  },
  'timesheet-signing-coord': {
    labelKey: 'timesheetSigningCoord',
    actionKey: 'countersign',
    isYourAction: true,
  },
  'timesheet-ready': {
    labelKey: 'timesheetReady',
    actionKey: null,
    isYourAction: false,
  },
  'timesheet-muted': {
    labelKey: 'timesheetMuted',
    actionKey: null,
    isYourAction: false,
  },
  'contract-declined': {
    labelKey: 'declined',
    actionKey: 'create',
    isYourAction: true,
  },
  'timesheet-declined': {
    labelKey: 'declined',
    actionKey: 'create',
    isYourAction: true,
  },
};

/** Whether this status is actionable by the org (coordinator) right now, as opposed to waiting on the volunteer or already resolved. */
export function isYourActionStatus(status: DocStatus): boolean {
  return STATUS_META[status].isYourAction;
}

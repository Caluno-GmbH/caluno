import type { PauschalenType } from '../components/doc-type-header';
import type { SigneeRole } from '../components/template/types';

export type DocStatus =
  | 'contract-generate'
  | 'contract-draft'
  | 'contract-signing-vol'
  | 'contract-signing-coord'
  | 'contract-active'
  // An ACTIVE contract whose stated period has ended: the signing chain is
  // complete, but it is no longer valid cover for the current month and a new
  // agreement must be created (VOLI-1370).
  | 'contract-expired'
  // Muted placeholder: implied by a 'timesheet-muted' sibling (or a
  // search-only, zero-document volunteer) but no contract flow has actually
  // been started. Not part of the automatic signup-triggered flow, so it
  // never counts toward the Contract·Generate tile — resolved only via the
  // manual "Create contract" action.
  | 'contract-missing'
  | 'timesheet-generate'
  | 'timesheet-signing-vol'
  | 'timesheet-signing-coord'
  | 'timesheet-ready'
  // Passive record: eligible hours from a paid shift where the contract
  // gate was bypassed. Rate × hours is still shown, but there's no "create"
  // CTA on this row — the fix is the paired contract-missing row instead.
  | 'timesheet-muted'
  // Terminal: signer rejected the document. Dead end — the fix is
  // reissuing a new document, never resuming this one.
  | 'contract-declined'
  | 'timesheet-declined';

export type DocumentTypeFilter = 'all' | 'contract' | 'timesheet';

export type PauschaleTypeFilter = 'all' | PauschalenType;

/** Pipeline stage the coordinator is filtering for. Tiles set this with `documentType`. */
export type NextActionFilter = 'any' | 'generate' | 'countersign' | 'send';

/**
 * All board filter controls as one object. Tiles set `documentType` + `nextAction`;
 * the dropdowns and search update the matching field. Never mutate `vol.documents`
 * from these — they only decide inclusion / display.
 */
export interface FilterSettings {
  documentType: DocumentTypeFilter;
  pauschaleType: PauschaleTypeFilter;
  dateRange: { from: Date | undefined; to?: Date | undefined } | undefined;
  volunteerName: string;
  nextAction: NextActionFilter;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  documentType: 'all',
  pauschaleType: 'all',
  dateRange: undefined,
  volunteerName: '',
  nextAction: 'any',
};

/** Display order for board filter tiles (All first, then the pipeline). */
export const BOARD_TILE_IDS = [
  'all',
  'contract-generate',
  'contract-signing',
  'timesheet-generate',
  'timesheet-signing',
  'ready-to-go',
] as const;

export type BoardTileId = (typeof BOARD_TILE_IDS)[number];

/** UI tile presets: each maps to a `documentType` + `nextAction` pair. */
export const BOARD_TILE_PRESETS: Record<
  BoardTileId,
  { documentType: DocumentTypeFilter; nextAction: NextActionFilter }
> = {
  all: { documentType: 'all', nextAction: 'any' },
  'contract-generate': { documentType: 'contract', nextAction: 'generate' },
  'contract-signing': { documentType: 'contract', nextAction: 'countersign' },
  'timesheet-generate': { documentType: 'timesheet', nextAction: 'generate' },
  'timesheet-signing': {
    documentType: 'timesheet',
    nextAction: 'countersign',
  },
  'ready-to-go': { documentType: 'all', nextAction: 'send' },
};

export interface BoardDocument {
  id: string;
  status: DocStatus;
  amount?: number;
  hours?: number;
  lastActionDate?: Date;
  periodLabel: string;
  /** The document's own period: a to-invoice row opens on this month, a declined timesheet on the period it was issued for. */
  periodStart?: Date;
  periodEnd?: Date;
  /** A draft contract's own Vertragslaufzeit ("08/2026", "2026", a day range): what creating the contract from it opens on. */
  draftLifespan?: string;
  /** The timesheet has an hour with no ACTIVE contract right now. Live from the backend, not the snapshot stored when the timesheet was created. */
  isNonCompliant?: boolean;
  /** Manually flagged: this timesheet's amount pushed the volunteer at/over their yearly cap. Unrelated to contract compliance. */
  isOverCap?: boolean;
  pauschale: PauschalenType;
  /** Set together when a signer rejects the document (contract-declined/timesheet-declined only). */
  declineReason?: string;
  declinedBy?: string;
  declinedAt?: Date;
  /** Which seat in the signing chain declined — determines where the pipeline/timeline gets cut off. */
  declinedAtRole?: SigneeRole;
}

export interface PauschalenLimit {
  used: number;
  total: number;
}

export interface BoardVolunteer {
  id: string;
  name: string;
  initials: string;
  usedAmount: number;
  totalCap: number;
  limits?: Partial<Record<PauschalenType, PauschalenLimit>>;
  /** Maps each pauschale type the volunteer is eligible for to its reimbursement type id. */
  reimbursementTypeIds?: Partial<Record<PauschalenType, string>>;
  documents: BoardDocument[];
}

/** A document paired with the volunteer it belongs to — needed once actions act across volunteers. */
export interface DocVolPair {
  doc: BoardDocument;
  vol: BoardVolunteer;
}

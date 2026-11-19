import { visibleDocumentsForVolunteer } from './board-filters';
import type {
  BoardDocument,
  BoardVolunteer,
  DocStatus,
  DocVolPair,
  FilterSettings,
  PauschalenType,
} from './board-types';

// ─── Display sort ──────────────────────────────────────────────────────────────

/**
 * Canonical display order for document rows within a volunteer group.
 * Moved here from `reimbursements-volunteer-group.tsx` so the table's
 * rendering order and mass-action "first offender" order share one source
 * of truth.
 */
export const STATUS_SORT_ORDER: DocStatus[] = [
  'contract-generate',
  'contract-draft',
  'contract-expired',
  'timesheet-generate',
  'contract-missing',
  'contract-signing-coord',
  'timesheet-signing-coord',
  'timesheet-ready',
  'contract-signing-vol',
  'timesheet-signing-vol',
  'contract-active',
  'timesheet-muted',
  'contract-declined',
  'timesheet-declined',
];

/** Returns a stable copy of `docs` sorted in canonical display order. */
export function sortDocsForDisplay(docs: BoardDocument[]): BoardDocument[] {
  return [...docs].sort(
    (a, b) =>
      STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status),
  );
}

// ─── Pair helpers ─────────────────────────────────────────────────────────────

/**
 * All visible doc–volunteer pairs across the given volunteers, sorted within
 * each volunteer by `sortDocsForDisplay` and in volunteer arrival order across
 * volunteers (the board already sorts volunteers upstream).
 */
export function visibleDocPairsInOrder(
  volunteers: BoardVolunteer[],
  filters: FilterSettings,
): DocVolPair[] {
  return volunteers.flatMap((vol) => {
    const docs = sortDocsForDisplay(visibleDocumentsForVolunteer(vol, filters));
    return docs.map((doc) => ({ doc, vol }));
  });
}

/** All visible doc ids (placeholders included) in display order. */
export function selectableDocIds(
  volunteers: BoardVolunteer[],
  filters: FilterSettings,
): string[] {
  return visibleDocPairsInOrder(volunteers, filters).map((p) => p.doc.id);
}

/**
 * Pairs whose doc id appears in `selected`, preserving display order.
 * Only pairs visible under the current filters are considered.
 */
export function resolveSelectedPairs(
  volunteers: BoardVolunteer[],
  filters: FilterSettings,
  selected: ReadonlySet<string>,
): DocVolPair[] {
  return visibleDocPairsInOrder(volunteers, filters).filter((p) =>
    selected.has(p.doc.id),
  );
}

// ─── Countersign selectors ────────────────────────────────────────────────────

/** Doc ids that need coordinator countersigning on the contract side. */
export function contractIdsToCountersign(pairs: DocVolPair[]): string[] {
  return pairs
    .filter((p) => p.doc.status === 'contract-signing-coord')
    .map((p) => p.doc.id);
}

/** Doc ids that need coordinator countersigning on the timesheet side. */
export function timesheetIdsToCountersign(pairs: DocVolPair[]): string[] {
  return pairs
    .filter((p) => p.doc.status === 'timesheet-signing-coord')
    .map((p) => p.doc.id);
}

// ─── Bundle grouping ──────────────────────────────────────────────────────────

export interface BundleGroup {
  volunteerId: string;
  volunteerName: string;
  pauschale: PauschalenType;
  reimbursementTypeId?: string;
  invoiceIds: string[];
}

/**
 * Groups `timesheet-ready` pairs by volunteer + pauschale into `BundleGroup`s.
 * Invoice ids within each group follow the display order of the input pairs.
 * Non-ready docs are ignored.
 */
export function groupBundles(pairs: DocVolPair[]): BundleGroup[] {
  const map = new Map<string, BundleGroup>();

  for (const { doc, vol } of pairs) {
    if (doc.status !== 'timesheet-ready') continue;
    const key = `${vol.id}::${doc.pauschale}`;
    const existing = map.get(key);
    if (existing) {
      existing.invoiceIds.push(doc.id);
    } else {
      map.set(key, {
        volunteerId: vol.id,
        volunteerName: vol.name,
        pauschale: doc.pauschale,
        reimbursementTypeId: vol.reimbursementTypeIds?.[doc.pauschale],
        invoiceIds: [doc.id],
      });
    }
  }

  return Array.from(map.values());
}

// ─── Blocking warning ─────────────────────────────────────────────────────────

/**
 * Returns the id of the first document in display order that blocks a mass
 * action: a doc with `isOverCap === true` or status `contract-missing`.
 * Returns `null` when none.
 */
export function firstBlockingDocId(pairs: DocVolPair[]): string | null {
  return pairs.find((p) => p.doc.isOverCap === true || p.doc.status === 'contract-missing')?.doc.id ?? null;
}

// ─── Async result summary ─────────────────────────────────────────────────────

/** Counts fulfilled vs rejected from a `Promise.allSettled` result array. */
export function summarizeSettled<T>(
  results: PromiseSettledResult<T>[],
): { succeeded: number; failed: number } {
  let succeeded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') succeeded++;
    else failed++;
  }
  return { succeeded, failed };
}

// ─── Send bundle routing ──────────────────────────────────────────────────────

/**
 * Splits bundle-send previews into `sendable` (has recipient + fits in email)
 * and `needsAttention` (missing recipient or too large). Extra fields on each
 * preview item pass through unchanged — a later task attaches `issues` here.
 */
export function splitSendableBundles<
  T extends { recipientEmail: string | null; fitsInEmail: boolean },
>(previews: T[]): { sendable: T[]; needsAttention: T[] } {
  const sendable: T[] = [];
  const needsAttention: T[] = [];
  for (const p of previews) {
    if (!p.recipientEmail || !p.fitsInEmail) needsAttention.push(p);
    else sendable.push(p);
  }
  return { sendable, needsAttention };
}

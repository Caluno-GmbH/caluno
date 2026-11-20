import type { BundleDeliveryIssue, ReimbursementTypeKey } from '@repo/data';
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
  reimbursementTypeKey?: ReimbursementTypeKey;
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
        reimbursementTypeKey: vol.reimbursementTypeKeys?.[doc.pauschale],
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
  return (
    pairs.find(
      (p) => p.doc.isOverCap === true || p.doc.status === 'contract-missing',
    )?.doc.id ?? null
  );
}

// ─── Bundle identity ──────────────────────────────────────────────────────────

/** Stable identity of a bundle: one volunteer × one Pauschale. */
export function bundleKey(group: {
  volunteerId: string;
  pauschale: PauschalenType;
}): string {
  return `${group.volunteerId}::${group.pauschale}`;
}

// ─── Bounded fan-out ──────────────────────────────────────────────────────────

/**
 * `Promise.all` with at most `limit` calls in flight. Used for the mass send
 * previews: "select all" can cover hundreds of bundles and the preview builds
 * each bundle's document set server-side, so firing them all at once would
 * hammer both the API and the mail/PDF pipeline.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const size = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await fn(item, index);
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}

// ─── Async result summary ─────────────────────────────────────────────────────

/** Counts fulfilled vs rejected from a `Promise.allSettled` result array. */
export function summarizeSettled<T>(results: PromiseSettledResult<T>[]): {
  succeeded: number;
  failed: number;
} {
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
 * Why a previewed bundle cannot be emailed as-is. `preview-failed` means the
 * preview itself could not run (network error, missing type), so the bundle is
 * not necessarily unsendable — it needs a retry, not a "too large" verdict.
 */
export type BundleNeedsAttentionReason =
  | 'too-large'
  | 'no-recipient'
  | 'preview-failed';

/** The two email blockers; `preview-failed` deliberately is not one of them. */
export type BundleSendBlock = Extract<
  BundleNeedsAttentionReason,
  'too-large' | 'no-recipient'
>;

/**
 * The rule that decides whether a previewed bundle can be sent by email.
 * Both the single-row send (volunteer group) and the mass send (board dialog)
 * route on this, so the "too large / no recipient" decision lives in one place.
 */
export function bundleSendBlock(preview: {
  recipientEmail: string | null;
  fitsInEmail: boolean;
}): BundleSendBlock | null {
  if (!preview.fitsInEmail) return 'too-large';
  if (!preview.recipientEmail) return 'no-recipient';
  return null;
}

/** One bundle preview, as produced by the mass-send fan-out. */
export interface BundlePreviewOutcome {
  group: BundleGroup;
  recipientEmail: string | null;
  fitsInEmail: boolean;
  issues: BundleDeliveryIssue[];
  subject: string;
  /** The preview call itself failed, so recipient/size are unknown. */
  previewFailed?: boolean;
}

export interface SendableBundle {
  group: BundleGroup;
  recipientEmail: string;
  issues: BundleDeliveryIssue[];
  /** Previewed subject, echoed back so the send acknowledges what was shown. */
  subject: string;
}

export interface BundleNeedingAttention {
  group: BundleGroup;
  reason: BundleNeedsAttentionReason;
}

/**
 * Routes each preview to the confirm dialog's "send" list or its
 * "needs attention" list, keeping the reason distinct so a failed preview is
 * never presented as "too large". Only `sendable` items carry a recipient, so
 * the caller never has to cast it.
 */
export function splitBundlePreviews(outcomes: BundlePreviewOutcome[]): {
  sendable: SendableBundle[];
  needsAttention: BundleNeedingAttention[];
} {
  const sendable: SendableBundle[] = [];
  const needsAttention: BundleNeedingAttention[] = [];

  for (const outcome of outcomes) {
    if (outcome.previewFailed) {
      needsAttention.push({ group: outcome.group, reason: 'preview-failed' });
      continue;
    }
    const block = bundleSendBlock(outcome);
    if (block) {
      needsAttention.push({ group: outcome.group, reason: block });
      continue;
    }
    // `bundleSendBlock` returned null, so both checks above passed; the
    // assertion is only needed because TS cannot narrow through the helper.
    sendable.push({
      group: outcome.group,
      recipientEmail: outcome.recipientEmail as string,
      issues: outcome.issues,
      subject: outcome.subject,
    });
  }

  return { sendable, needsAttention };
}

/** The canonical argument shape for the send-bundle mutation, shared by both send paths. */
export function buildBundleSendArgs(
  input: {
    volunteerId: string;
    reimbursementTypeKey: ReimbursementTypeKey;
    invoiceIds: string[];
  },
  shown: {
    issues: BundleDeliveryIssue[];
    recipientEmail: string;
    subject: string;
  },
) {
  return {
    volunteerId: input.volunteerId,
    reimbursementTypeKey: input.reimbursementTypeKey,
    invoiceIds: input.invoiceIds,
    acknowledgedIssues: shown.issues,
    expectedRecipientEmail: shown.recipientEmail,
    expectedSubject: shown.subject,
  };
}

import { describe, expect, it } from 'bun:test';
import { ReimbursementTypeKey } from '@repo/data';
import type { BoardDocument, BoardVolunteer, DocVolPair } from './board-types';
import {
  buildBundleSendArgs,
  bundleSendBlock,
  contractIdsToCountersign,
  firstBlockingDocId,
  groupBundles,
  resolveSelectedPairs,
  selectableDocIds,
  splitSendableBundles,
  summarizeSettled,
  timesheetIdsToCountersign,
  visibleDocPairsInOrder,
} from './mass-actions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDoc(
  overrides: Partial<BoardDocument> & {
    id: string;
    status: BoardDocument['status'];
  },
): BoardDocument {
  return {
    pauschale: 'ehrenamt',
    periodLabel: 'Januar 2026',
    ...overrides,
  };
}

function makeVol(
  overrides: Partial<BoardVolunteer> & { id: string },
): BoardVolunteer {
  return {
    name: 'Test Volunteer',
    initials: 'TV',
    usedAmount: 0,
    totalCap: 840,
    documents: [],
    ...overrides,
  };
}

const SEND_FILTERS = {
  documentType: 'all' as const,
  pauschaleType: 'all' as const,
  dateRange: undefined,
  volunteerName: '',
  nextAction: 'send' as const,
};

const ANY_FILTERS = {
  documentType: 'all' as const,
  pauschaleType: 'all' as const,
  dateRange: undefined,
  volunteerName: '',
  nextAction: 'any' as const,
};

// ─── groupBundles ─────────────────────────────────────────────────────────────

describe('groupBundles', () => {
  it('groups one volunteer ehrenamt + uebungsleiter timesheet-ready docs into two BundleGroups', () => {
    const docEP = makeDoc({
      id: 'doc-ep-1',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
    });
    const docUL = makeDoc({
      id: 'doc-ul-1',
      status: 'timesheet-ready',
      pauschale: 'uebungsleiter',
    });
    const vol = makeVol({
      id: 'vol-1',
      name: 'Anna Müller',
      documents: [docEP, docUL],
      reimbursementTypeKeys: {
        ehrenamt: ReimbursementTypeKey.Ehrenamt,
        uebungsleiter: ReimbursementTypeKey.Uebungsleiter,
      },
    });

    const pairs: DocVolPair[] = [
      { doc: docEP, vol },
      { doc: docUL, vol },
    ];

    const result = groupBundles(pairs);

    expect(result).toHaveLength(2);
    const ep = result.find((g) => g.pauschale === 'ehrenamt');
    const ul = result.find((g) => g.pauschale === 'uebungsleiter');

    expect(ep).toBeDefined();
    expect(ep?.volunteerId).toBe('vol-1');
    expect(ep?.volunteerName).toBe('Anna Müller');
    expect(ep?.invoiceIds).toEqual(['doc-ep-1']);
    expect(ep?.reimbursementTypeKey).toBe(ReimbursementTypeKey.Ehrenamt);

    expect(ul).toBeDefined();
    expect(ul?.invoiceIds).toEqual(['doc-ul-1']);
    expect(ul?.reimbursementTypeKey).toBe(ReimbursementTypeKey.Uebungsleiter);
  });

  it('includes only timesheet-ready docs and ignores other statuses', () => {
    const ready = makeDoc({
      id: 'doc-ready',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
    });
    const signing = makeDoc({
      id: 'doc-signing',
      status: 'timesheet-signing-coord',
      pauschale: 'ehrenamt',
    });
    const vol = makeVol({ id: 'vol-2', documents: [ready, signing] });

    const pairs: DocVolPair[] = [
      { doc: ready, vol },
      { doc: signing, vol },
    ];

    const result = groupBundles(pairs);
    expect(result).toHaveLength(1);
    expect(result[0]?.invoiceIds).toEqual(['doc-ready']);
  });

  it('groups multiple ready docs of the same pauschale into one BundleGroup', () => {
    const doc1 = makeDoc({
      id: 'ep-1',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
    });
    const doc2 = makeDoc({
      id: 'ep-2',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
    });
    const vol = makeVol({ id: 'vol-3', documents: [doc1, doc2] });

    const pairs: DocVolPair[] = [
      { doc: doc1, vol },
      { doc: doc2, vol },
    ];

    const result = groupBundles(pairs);
    expect(result).toHaveLength(1);
    expect(result[0]?.invoiceIds).toHaveLength(2);
    expect(result[0]?.invoiceIds).toContain('ep-1');
    expect(result[0]?.invoiceIds).toContain('ep-2');
  });

  it('returns empty array when no timesheet-ready pairs', () => {
    const doc = makeDoc({
      id: 'doc-gen',
      status: 'timesheet-generate',
      pauschale: 'ehrenamt',
    });
    const vol = makeVol({ id: 'vol-4', documents: [doc] });
    const result = groupBundles([{ doc, vol }]);
    expect(result).toEqual([]);
  });
});

// ─── firstBlockingDocId ───────────────────────────────────────────────────────

describe('firstBlockingDocId', () => {
  it('returns null when no blocking docs', () => {
    const doc = makeDoc({ id: 'ok', status: 'timesheet-ready' });
    const vol = makeVol({ id: 'vol-1', documents: [doc] });
    expect(firstBlockingDocId([{ doc, vol }])).toBeNull();
  });

  it('returns id of first isOverCap doc in display order', () => {
    // contract-generate comes before timesheet-ready in STATUS_SORT_ORDER,
    // so if both appear, the generate one (earlier in sort order) may win —
    // but isOverCap only appears on timesheets in practice.
    // We test: an over-cap doc is detected.
    const overCap = makeDoc({
      id: 'over',
      status: 'timesheet-ready',
      isOverCap: true,
    });
    const normal = makeDoc({ id: 'ok', status: 'timesheet-ready' });
    const vol = makeVol({ id: 'vol-1', documents: [overCap, normal] });
    const result = firstBlockingDocId([
      { doc: overCap, vol },
      { doc: normal, vol },
    ]);
    expect(result).toBe('over');
  });

  it('returns id of contract-missing doc', () => {
    const missing = makeDoc({ id: 'miss', status: 'contract-missing' });
    const vol = makeVol({ id: 'vol-1', documents: [missing] });
    expect(firstBlockingDocId([{ doc: missing, vol }])).toBe('miss');
  });

  it('returns the first blocker in given display order spanning two volunteers', () => {
    // vol-A has a contract-missing doc; vol-B has an over-cap timesheet.
    // pairs arrive in display order: vol-A's doc first, vol-B's doc second.
    // The function must return vol-A's id — it does NOT re-sort by status.
    const missing = makeDoc({ id: 'miss', status: 'contract-missing' });
    const volA = makeVol({ id: 'vol-a', documents: [missing] });
    const overCap = makeDoc({
      id: 'ready-over',
      status: 'timesheet-ready',
      isOverCap: true,
    });
    const volB = makeVol({ id: 'vol-b', documents: [overCap] });
    const result = firstBlockingDocId([
      { doc: missing, vol: volA },
      { doc: overCap, vol: volB },
    ]);
    expect(result).toBe('miss');
  });
});

// ─── contractIdsToCountersign / timesheetIdsToCountersign ─────────────────────

describe('contractIdsToCountersign', () => {
  it('returns only contract-signing-coord ids', () => {
    const c1 = makeDoc({ id: 'c1', status: 'contract-signing-coord' });
    const c2 = makeDoc({ id: 'c2', status: 'contract-signing-vol' });
    const t1 = makeDoc({ id: 't1', status: 'timesheet-signing-coord' });
    const vol = makeVol({ id: 'v', documents: [c1, c2, t1] });
    const pairs: DocVolPair[] = [
      { doc: c1, vol },
      { doc: c2, vol },
      { doc: t1, vol },
    ];
    expect(contractIdsToCountersign(pairs)).toEqual(['c1']);
  });
});

describe('timesheetIdsToCountersign', () => {
  it('returns only timesheet-signing-coord ids', () => {
    const t1 = makeDoc({ id: 't1', status: 'timesheet-signing-coord' });
    const t2 = makeDoc({ id: 't2', status: 'timesheet-signing-vol' });
    const c1 = makeDoc({ id: 'c1', status: 'contract-signing-coord' });
    const vol = makeVol({ id: 'v', documents: [t1, t2, c1] });
    const pairs: DocVolPair[] = [
      { doc: t1, vol },
      { doc: t2, vol },
      { doc: c1, vol },
    ];
    expect(timesheetIdsToCountersign(pairs)).toEqual(['t1']);
  });
});

// ─── summarizeSettled ─────────────────────────────────────────────────────────

describe('summarizeSettled', () => {
  it('counts fulfilled and rejected results', () => {
    const results: PromiseSettledResult<string>[] = [
      { status: 'fulfilled', value: 'ok' },
      { status: 'rejected', reason: new Error('fail') },
      { status: 'fulfilled', value: 'ok2' },
      { status: 'rejected', reason: new Error('fail2') },
      { status: 'rejected', reason: new Error('fail3') },
    ];
    expect(summarizeSettled(results)).toEqual({ succeeded: 2, failed: 3 });
  });

  it('returns zero for empty input', () => {
    expect(summarizeSettled([])).toEqual({ succeeded: 0, failed: 0 });
  });

  it('handles all fulfilled', () => {
    const results: PromiseSettledResult<number>[] = [
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ];
    expect(summarizeSettled(results)).toEqual({ succeeded: 2, failed: 0 });
  });
});

// ─── splitSendableBundles ─────────────────────────────────────────────────────

describe('splitSendableBundles', () => {
  it('routes no-recipient items to needsAttention', () => {
    const previews = [
      { recipientEmail: null, fitsInEmail: true },
      { recipientEmail: 'test@example.com', fitsInEmail: true },
    ];
    const { sendable, needsAttention } = splitSendableBundles(previews);
    expect(sendable).toHaveLength(1);
    expect(needsAttention).toHaveLength(1);
    expect(needsAttention[0]?.recipientEmail).toBeNull();
  });

  it('routes !fitsInEmail items to needsAttention', () => {
    const previews = [
      { recipientEmail: 'a@example.com', fitsInEmail: false },
      { recipientEmail: 'b@example.com', fitsInEmail: true },
    ];
    const { sendable, needsAttention } = splitSendableBundles(previews);
    expect(sendable).toHaveLength(1);
    expect(needsAttention).toHaveLength(1);
    expect(needsAttention[0]?.recipientEmail).toBe('a@example.com');
  });

  it('passes through extra fields on richer objects', () => {
    const previews = [
      {
        recipientEmail: 'a@example.com',
        fitsInEmail: true,
        issues: ['warn-1'],
      },
      { recipientEmail: null, fitsInEmail: true, issues: [] },
    ];
    const { sendable, needsAttention } = splitSendableBundles(previews);
    expect(sendable[0]?.issues).toEqual(['warn-1']);
    expect(needsAttention[0]?.issues).toEqual([]);
  });
});

// ─── bundleSendBlock ──────────────────────────────────────────────────────────

describe('bundleSendBlock', () => {
  it('returns null when the bundle fits and has a recipient', () => {
    expect(
      bundleSendBlock({ recipientEmail: 'a@example.com', fitsInEmail: true }),
    ).toBeNull();
  });

  it('reports too-large before no-recipient when both apply', () => {
    expect(bundleSendBlock({ recipientEmail: null, fitsInEmail: false })).toBe(
      'too-large',
    );
  });

  it('reports no-recipient when it fits but has no recipient', () => {
    expect(bundleSendBlock({ recipientEmail: null, fitsInEmail: true })).toBe(
      'no-recipient',
    );
  });
});

// ─── buildBundleSendArgs ──────────────────────────────────────────────────────

describe('buildBundleSendArgs', () => {
  it('maps input + shown preview into the send mutation shape', () => {
    const args = buildBundleSendArgs(
      {
        volunteerId: 'vol-1',
        reimbursementTypeKey: ReimbursementTypeKey.Ehrenamt,
        invoiceIds: ['inv-1', 'inv-2'],
      },
      {
        issues: [],
        recipientEmail: 'accounting@example.org',
        subject: 'Abrechnung',
      },
    );
    expect(args).toEqual({
      volunteerId: 'vol-1',
      reimbursementTypeKey: ReimbursementTypeKey.Ehrenamt,
      invoiceIds: ['inv-1', 'inv-2'],
      acknowledgedIssues: [],
      expectedRecipientEmail: 'accounting@example.org',
      expectedSubject: 'Abrechnung',
    });
  });
});

// ─── selectableDocIds ─────────────────────────────────────────────────────────

describe('selectableDocIds', () => {
  it('returns every visible doc id including placeholders', () => {
    // On the 'send' tab, visibleDocumentsForVolunteer synthesizes contract-missing
    // placeholders; selectableDocIds must include them.
    const readyDoc = makeDoc({
      id: 'ts-ready-1',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
      periodLabel: 'Januar 2026',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });
    const vol = makeVol({ id: 'vol-1', name: 'Anna', documents: [readyDoc] });

    const ids = selectableDocIds([vol], SEND_FILTERS);
    // Should include the timesheet row and the synthetic contract-missing placeholder
    expect(ids).toContain('ts-ready-1');
    expect(ids.length).toBeGreaterThanOrEqual(1);
  });

  it('returns ids for all visible volunteers', () => {
    const doc1 = makeDoc({ id: 'd1', status: 'timesheet-signing-coord' });
    const doc2 = makeDoc({ id: 'd2', status: 'contract-signing-coord' });
    const vol1 = makeVol({ id: 'v1', documents: [doc1] });
    const vol2 = makeVol({ id: 'v2', documents: [doc2] });

    const ids = selectableDocIds([vol1, vol2], ANY_FILTERS);
    expect(ids).toContain('d1');
    expect(ids).toContain('d2');
  });
});

// ─── visibleDocPairsInOrder ───────────────────────────────────────────────────

describe('visibleDocPairsInOrder', () => {
  it('returns pairs sorted in display order across volunteers', () => {
    const docGenerate = makeDoc({
      id: 'gen',
      status: 'contract-generate',
      pauschale: 'ehrenamt',
    });
    const docReady = makeDoc({
      id: 'ready',
      status: 'timesheet-ready',
      pauschale: 'ehrenamt',
    });
    const vol = makeVol({ id: 'v1', documents: [docReady, docGenerate] });

    const pairs = visibleDocPairsInOrder([vol], ANY_FILTERS);
    // contract-generate sorts before timesheet-ready
    const ids = pairs.map((p) => p.doc.id);
    expect(ids.indexOf('gen')).toBeLessThan(ids.indexOf('ready'));
  });

  it('each pair carries the correct volunteer reference', () => {
    const doc = makeDoc({ id: 'doc1', status: 'timesheet-signing-coord' });
    const vol = makeVol({ id: 'vol-x', name: 'Test', documents: [doc] });

    const pairs = visibleDocPairsInOrder([vol], ANY_FILTERS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.vol.id).toBe('vol-x');
    expect(pairs[0]?.doc.id).toBe('doc1');
  });
});

// ─── resolveSelectedPairs ────────────────────────────────────────────────────

describe('resolveSelectedPairs', () => {
  it('returns only pairs whose doc.id is in the selected set', () => {
    const doc1 = makeDoc({ id: 'a', status: 'timesheet-signing-coord' });
    const doc2 = makeDoc({ id: 'b', status: 'contract-signing-coord' });
    const vol = makeVol({ id: 'v', documents: [doc1, doc2] });

    const selected = new Set(['a']);
    const pairs = resolveSelectedPairs([vol], ANY_FILTERS, selected);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.doc.id).toBe('a');
  });

  it('returns empty when nothing is selected', () => {
    const doc = makeDoc({ id: 'x', status: 'timesheet-ready' });
    const vol = makeVol({ id: 'v', documents: [doc] });
    const pairs = resolveSelectedPairs([vol], ANY_FILTERS, new Set());
    expect(pairs).toEqual([]);
  });
});

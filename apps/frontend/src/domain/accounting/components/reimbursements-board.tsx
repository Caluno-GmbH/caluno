'use client';

import { BundleDeliveryMethod } from '@repo/data';
import {
  useAccountingDeliverySettings,
  useBundleSendPreview,
  useDeclineContract,
  useDeclineInvoice,
  useQueryClient,
  useSendReimbursementBundle,
  useSignContract,
  useSignInvoice,
} from '@repo/data/react';
import {
  cn,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@repo/ui';
import {
  AlertCircleIcon,
  ArrowUpDownIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FilterXIcon,
  SearchIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useReimbursementBoardData } from '../hooks/use-reimbursement-board-data';
import {
  creationTargetFor,
  initialLifespanFor,
  sourceDraftIdFor,
} from '../lib/board-data.utils';
import {
  documentMatchesFilterSettings,
  filterVolunteers,
  visibleDocumentsForVolunteer,
} from '../lib/board-filters';
import { isYourActionStatus } from '../lib/board-status';
import type {
  BoardTileId,
  BoardVolunteer,
  DocumentTypeFilter,
  DocVolPair,
  FilterSettings,
  PauschaleTypeFilter,
} from '../lib/board-types';
import {
  BOARD_TILE_IDS,
  BOARD_TILE_PRESETS,
  DEFAULT_FILTER_SETTINGS,
} from '../lib/board-types';
import {
  requestBundleDownload,
  triggerBlobDownload,
} from '../lib/download-bundle';
import {
  contractIdsToCountersign,
  firstBlockingDocId,
  groupBundles,
  resolveSelectedPairs,
  selectableDocIds,
  splitSendableBundles,
  summarizeSettled,
  timesheetIdsToCountersign,
} from '../lib/mass-actions';
import {
  documentCreationBlockedFor,
  type TemplateReadinessByPauschale,
} from '../lib/setup-status';
import { BundleBatchConfirmDialog } from './bundle-batch-confirm-dialog';
import { ContractCreationModal } from './contract-creation-modal';
import { CreateDocumentModal } from './create-document-modal';
import { InvoiceCreationModal } from './invoice-creation-modal';
import { MassActionBar } from './mass-action-bar';
import type { DateRange } from './period-picker';
import { lastMonthRange, PeriodPicker, thisMonthRange } from './period-picker';
import { DocumentSheet } from './reimbursements-document-sheet';
import { ReimbursementsTable } from './reimbursements-volunteer-group';

type SortOption = 'action-needed' | 'newest';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 2,
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
];

function newestDocTimestamp(vol: BoardVolunteer): number {
  return vol.documents.reduce((max, d) => {
    const t = d.lastActionDate?.getTime();
    return t !== undefined && t > max ? t : max;
  }, -Infinity);
}

function actionableDocCount(vol: BoardVolunteer): number {
  return vol.documents.filter((d) => isYourActionStatus(d.status)).length;
}

function sortVolunteers(
  vols: BoardVolunteer[],
  option: SortOption,
): BoardVolunteer[] {
  return [...vols].sort((a, b) =>
    option === 'newest'
      ? newestDocTimestamp(b) - newestDocTimestamp(a)
      : actionableDocCount(b) - actionableDocCount(a) ||
        newestDocTimestamp(b) - newestDocTimestamp(a),
  );
}

function tilePresetSettings(
  tileId: BoardTileId,
  pauschaleType: PauschaleTypeFilter,
): FilterSettings {
  const preset = BOARD_TILE_PRESETS[tileId];
  return {
    ...DEFAULT_FILTER_SETTINGS,
    documentType: preset.documentType,
    nextAction: preset.nextAction,
    pauschaleType,
  };
}

function isTileActive(settings: FilterSettings, tileId: BoardTileId): boolean {
  const preset = BOARD_TILE_PRESETS[tileId];
  return (
    settings.documentType === preset.documentType &&
    settings.nextAction === preset.nextAction
  );
}

/** Tile badge counts are pauschale-scoped only — date/name stay out so totals stay stable. */
function countForTile(
  volunteers: BoardVolunteer[],
  tileId: BoardTileId,
  pauschaleType: PauschaleTypeFilter,
): number {
  const settings = tilePresetSettings(tileId, pauschaleType);
  return volunteers.reduce(
    (sum, vol) =>
      sum +
      vol.documents.filter((d) => documentMatchesFilterSettings(d, settings))
        .length,
    0,
  );
}

/** How many of a tile's matching docs are actionable by the org right now. */
function countActionableForTile(
  volunteers: BoardVolunteer[],
  tileId: BoardTileId,
  pauschaleType: PauschaleTypeFilter,
): number {
  const settings = tilePresetSettings(tileId, pauschaleType);
  return volunteers.reduce(
    (sum, vol) =>
      sum +
      vol.documents.filter(
        (d) =>
          documentMatchesFilterSettings(d, settings) &&
          isYourActionStatus(d.status),
      ).length,
    0,
  );
}

// ─── FilterTile (step card, no icon box) ─────────────────────────────────────

interface FilterTileProps {
  label: string;
  count: number;
  /** Docs within `count` that are actionable by the org right now (e.g. a signing tile's coordinator/supervisor-turn subset). Omit for tiles where the whole count is already "your action". */
  actionableCount?: number;
  active: boolean;
  onClick: () => void;
}

function FilterTile({
  label,
  count,
  actionableCount,
  active,
  onClick,
}: FilterTileProps) {
  const t = useTranslations('Accounting.reimbursements');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-[160px] flex-1 flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-card hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'text-base font-semibold leading-tight hyphens-auto break-words',
          active ? 'text-primary' : 'text-card-foreground',
        )}
      >
        {label}
      </span>
      {!!actionableCount && (
        <span className="text-base font-semibold text-primary tabular-nums">
          {t('tiles.waitingOnYou', { count: actionableCount })}
        </span>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        {t('tiles.docCount', { count })}
      </span>
    </button>
  );
}

// ─── ReimbursementsBoard ──────────────────────────────────────────────────────

interface ReimbursementsBoardProps {
  orgUId: string;
  /** Owned by the page header — see reimbursements-page-header.tsx. */
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  year: number;
  onYearChange: (year: number) => void;
  /** Fired when the "Ready to go" tile is selected — the page header narrows its own range to this month. */
  createDocOpen: boolean;
  onCreateDocOpenChange: (open: boolean) => void;
  canCreateDocuments: boolean;
  /** Per-Pauschale template state — blocks a create action whose template is missing. */
  templateReadiness: TemplateReadinessByPauschale;
}

export function ReimbursementsBoard({
  orgUId,
  dateRange,
  onDateRangeChange,
  year,
  onYearChange,
  createDocOpen,
  onCreateDocOpenChange,
  canCreateDocuments,
  templateReadiness,
}: ReimbursementsBoardProps) {
  const t = useTranslations('Accounting.reimbursements');

  const { volunteers, isLoading, error } = useReimbursementBoardData({
    orgUId,
    dateRange,
    year,
  });

  const signContract = useSignContract();
  const signInvoice = useSignInvoice();
  const declineContract = useDeclineContract();
  const declineInvoice = useDeclineInvoice();
  const preview = useBundleSendPreview();
  const send = useSendReimbursementBundle();
  const queryClient = useQueryClient();

  const deliverySettingsQuery = useAccountingDeliverySettings(orgUId);
  const deliverySettings = deliverySettingsQuery.data;
  const bundleMode: 'send' | 'download' =
    deliverySettings?.deliveryMethod === BundleDeliveryMethod.Email &&
    deliverySettings.recipientEmail
      ? 'send'
      : 'download';

  // Filters — one object; dateRange stays owned by the page header and is merged in.
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(
    DEFAULT_FILTER_SETTINGS,
  );
  const [sortOption, setSortOption] = useState<SortOption>('action-needed');

  const effectiveFilterSettings = useMemo(
    (): FilterSettings => ({ ...filterSettings, dateRange }),
    [filterSettings, dateRange],
  );

  const filteredVolunteers = useMemo(
    () => filterVolunteers(volunteers, effectiveFilterSettings),
    [volunteers, effectiveFilterSettings],
  );

  const sortedFilteredVolunteers = useMemo(
    () => sortVolunteers(filteredVolunteers, sortOption),
    [filteredVolunteers, sortOption],
  );

  // ─── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection whenever view-defining filters change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on specific filter fields and props
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    filterSettings.documentType,
    filterSettings.nextAction,
    filterSettings.pauschaleType,
    filterSettings.volunteerName,
    dateRange,
    year,
  ]);

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVolunteer(vol: BoardVolunteer, select: boolean) {
    const ids = visibleDocumentsForVolunteer(vol, effectiveFilterSettings).map(
      (d) => d.id,
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (select)
        ids.forEach((id) => {
          next.add(id);
        });
      else
        ids.forEach((id) => {
          next.delete(id);
        });
      return next;
    });
  }

  function toggleAll(select: boolean) {
    if (select) {
      setSelectedIds(
        new Set(
          selectableDocIds(sortedFilteredVolunteers, effectiveFilterSettings),
        ),
      );
    } else {
      setSelectedIds(new Set());
    }
  }

  // ─── Row-ref registry + highlight ───────────────────────────────────────────
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);

  function registerRowRef(id: string, el: HTMLElement | null) {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }

  function scrollToAndHighlight(id: string) {
    const el = rowRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedDocId(id);
    setTimeout(() => setHighlightedDocId(null), 2000);
  }

  // ─── Guard ───────────────────────────────────────────────────────────────────
  function guardSelection(pairs: DocVolPair[]): boolean {
    const id = firstBlockingDocId(pairs);
    if (id) {
      scrollToAndHighlight(id);
      toast.error(t('massActions.blockedByIssues'));
      return false;
    }
    return true;
  }

  // ─── Mass-action state ───────────────────────────────────────────────────────
  const [busyAction, setBusyAction] = useState<
    'contracts' | 'timesheets' | 'bundles' | null
  >(null);

  // Bundle batch confirm dialog state
  type SendableItem = {
    group: ReturnType<typeof groupBundles>[number];
    recipientEmail: string;
    issues: import('@repo/data').BundleDeliveryIssue[];
    subject: string;
  };
  type NeedsAttentionItem = {
    group: ReturnType<typeof groupBundles>[number];
    reason: 'no-recipient' | 'too-large';
  };
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchSendable, setBatchSendable] = useState<SendableItem[]>([]);
  const [batchNeedsAttention, setBatchNeedsAttention] = useState<
    NeedsAttentionItem[]
  >([]);
  // ─── Mass countersign handlers ───────────────────────────────────────────────
  async function handleMassCountersignContracts() {
    const pairs = resolveSelectedPairs(
      sortedFilteredVolunteers,
      effectiveFilterSettings,
      selectedIds,
    );
    if (!guardSelection(pairs)) return;
    const ids = contractIdsToCountersign(pairs);
    if (ids.length === 0) return;
    setBusyAction('contracts');
    try {
      const results = await Promise.allSettled(
        ids.map((id) => signContract.mutateAsync(id)),
      );
      const { succeeded, failed } = summarizeSettled(results);
      if (failed === 0) {
        toast.success(
          t('massActions.countersignContractsDone', { count: succeeded }),
        );
      } else {
        toast.warning(
          t('massActions.countersignContractsPartial', {
            done: succeeded,
            total: ids.length,
            failed,
          }),
        );
      }
      // Remove successfully acted ids from selection.
      const succeededIds = new Set(
        results
          .map((r, i) => (r.status === 'fulfilled' ? ids[i] : null))
          .filter((id): id is string => id !== null),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        succeededIds.forEach((id) => {
          next.delete(id);
        });
        return next;
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMassCountersignTimesheets() {
    const pairs = resolveSelectedPairs(
      sortedFilteredVolunteers,
      effectiveFilterSettings,
      selectedIds,
    );
    if (!guardSelection(pairs)) return;
    const ids = timesheetIdsToCountersign(pairs);
    if (ids.length === 0) return;
    setBusyAction('timesheets');
    try {
      const results = await Promise.allSettled(
        ids.map((id) => signInvoice.mutateAsync(id)),
      );
      const { succeeded, failed } = summarizeSettled(results);
      if (failed === 0) {
        toast.success(
          t('massActions.countersignTimesheetsDone', { count: succeeded }),
        );
      } else {
        toast.warning(
          t('massActions.countersignTimesheetsPartial', {
            done: succeeded,
            total: ids.length,
            failed,
          }),
        );
      }
      const succeededIds = new Set(
        results
          .map((r, i) => (r.status === 'fulfilled' ? ids[i] : null))
          .filter((id): id is string => id !== null),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        succeededIds.forEach((id) => {
          next.delete(id);
        });
        return next;
      });
    } finally {
      setBusyAction(null);
    }
  }

  // ─── Mass bundle handler ─────────────────────────────────────────────────────
  async function handleMassBundles() {
    const pairs = resolveSelectedPairs(
      sortedFilteredVolunteers,
      effectiveFilterSettings,
      selectedIds,
    );
    if (!guardSelection(pairs)) return;
    const groups = groupBundles(pairs);
    if (groups.length === 0) return;
    setBusyAction('bundles');

    try {
      if (bundleMode === 'send') {
        // Run previews for each group; failures count as needs-attention.
        type PreviewResult = {
          group: ReturnType<typeof groupBundles>[number];
          recipientEmail: string | null;
          fitsInEmail: boolean;
          issues: import('@repo/data').BundleDeliveryIssue[];
          subject: string;
        };
        const previewResults: PreviewResult[] = await Promise.all(
          groups.map(async (group) => {
            if (!group.reimbursementTypeKey) {
              return {
                group,
                recipientEmail: null,
                fitsInEmail: false,
                issues: [],
                subject: '',
              };
            }
            try {
              const result = await preview.mutateAsync({
                volunteerId: group.volunteerId,
                reimbursementTypeKey: group.reimbursementTypeKey,
                invoiceIds: group.invoiceIds,
              });
              return { group, ...result };
            } catch {
              return {
                group,
                recipientEmail: null,
                fitsInEmail: false,
                issues: [],
                subject: '',
              };
            }
          }),
        );

        const { sendable, needsAttention: rawNeedsAttention } =
          splitSendableBundles(previewResults);

        const dialogSendable: SendableItem[] = sendable.map((p) => ({
          group: p.group,
          recipientEmail: p.recipientEmail as string,
          issues: p.issues,
          subject: p.subject,
        }));
        const dialogNeedsAttention: NeedsAttentionItem[] =
          rawNeedsAttention.map((p) => ({
            group: p.group,
            reason: !p.recipientEmail ? 'no-recipient' : 'too-large',
          }));

        setBatchSendable(dialogSendable);
        setBatchNeedsAttention(dialogNeedsAttention);
        setBatchDialogOpen(true);
      } else {
        // Download mode — no dialog.
        const results = await Promise.allSettled(
          groups
            .filter((g) => g.reimbursementTypeKey !== undefined)
            .map((g) =>
              requestBundleDownload({
                volunteerId: g.volunteerId,
                reimbursementTypeKey: g.reimbursementTypeKey as string,
                invoiceIds: g.invoiceIds,
                orgUId,
              }).then((blob) =>
                triggerBlobDownload(
                  blob,
                  `Abrechnung-${g.volunteerId.slice(0, 8)}.zip`,
                ),
              ),
            ),
        );
        const noTypeCount = groups.filter(
          (g) => g.reimbursementTypeKey === undefined,
        ).length;
        const { succeeded, failed } = summarizeSettled(results);
        queryClient.invalidateQueries({ queryKey: ['accounting'] });
        const totalFailed = failed + noTypeCount;
        if (totalFailed > 0) {
          toast.warning(
            t('massActions.bundlesDownloadedDone', { count: succeeded }) +
              ' · ' +
              t('massActions.bundlesNeedAttention', { count: totalFailed }),
          );
        } else {
          toast.success(
            t('massActions.bundlesDownloadedDone', { count: succeeded }),
          );
        }
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBatchConfirm(keysToSend: string[]) {
    const keySet = new Set(keysToSend);
    const toSend = batchSendable.filter((p) =>
      keySet.has(`${p.group.volunteerId}::${p.group.pauschale}`),
    );
    if (toSend.length === 0) {
      setBatchDialogOpen(false);
      return;
    }
    setBusyAction('bundles');
    const needsAttentionCount = batchNeedsAttention.length;
    try {
      const results = await Promise.allSettled(
        toSend.map((p) => {
          if (!p.group.reimbursementTypeKey)
            return Promise.reject(new Error('no-type'));
          return send.mutateAsync({
            volunteerId: p.group.volunteerId,
            reimbursementTypeKey: p.group.reimbursementTypeKey,
            invoiceIds: p.group.invoiceIds,
            acknowledgedIssues: p.issues,
            expectedRecipientEmail: p.recipientEmail,
            expectedSubject: p.subject,
          });
        }),
      );
      const { succeeded, failed } = summarizeSettled(results);
      const totalNeedsAttention = failed + needsAttentionCount;
      if (totalNeedsAttention > 0) {
        toast.warning(
          t('massActions.bundlesSentDone', { count: succeeded }) +
            ' · ' +
            t('massActions.bundlesNeedAttention', {
              count: totalNeedsAttention,
            }),
        );
      } else {
        toast.success(t('massActions.bundlesSentDone', { count: succeeded }));
      }
    } finally {
      setBusyAction(null);
      setBatchDialogOpen(false);
    }
  }

  // ─── Derived selection counts ────────────────────────────────────────────────
  // Computed lazily only when selectedIds is non-empty to avoid work on every render.
  const resolvedSelectionCounts = useMemo(() => {
    if (selectedIds.size === 0) {
      return { contractCount: 0, timesheetCount: 0, bundleCount: 0 };
    }
    const pairs = resolveSelectedPairs(
      sortedFilteredVolunteers,
      effectiveFilterSettings,
      selectedIds,
    );
    return {
      contractCount: contractIdsToCountersign(pairs).length,
      timesheetCount: timesheetIdsToCountersign(pairs).length,
      bundleCount: groupBundles(pairs).length,
    };
  }, [selectedIds, sortedFilteredVolunteers, effectiveFilterSettings]);

  // Sheet
  const [selectedDoc, setSelectedDoc] = useState<DocVolPair | null>(null);

  // Contract creation modal (solo contract-generate / contract-declined rows)
  const [contractCreationTarget, setContractCreationTarget] =
    useState<DocVolPair | null>(null);

  // Invoice creation modal (solo timesheet-generate / timesheet-declined rows)
  const [invoiceCreationTarget, setInvoiceCreationTarget] =
    useState<DocVolPair | null>(null);

  function handleRequestCreate(pair: DocVolPair) {
    if (!canCreateDocuments) return;
    const target = creationTargetFor(pair.doc.status);
    // Never open a create modal whose template is missing — the admin would
    // only reach the raw "no template" dead end.
    const pauschale = pair.doc.pauschale;
    if (
      target &&
      documentCreationBlockedFor(templateReadiness, pauschale, target)
    ) {
      return;
    }
    if (target === 'contract') {
      setContractCreationTarget(pair);
      return;
    }
    if (target === 'invoice') {
      setInvoiceCreationTarget(pair);
      return;
    }
    // Never swallow a click: tell the admin why nothing opens.
    toast.error(t('createUnavailable', { name: pair.vol.name }));
  }

  function handleSign(pair: DocVolPair) {
    const { doc, vol } = pair;
    if (doc.status === 'contract-signing-coord') {
      signContract.mutate(doc.id, {
        onSuccess: () =>
          toast.success(t('signToasts.contract', { name: vol.name })),
        onError: () =>
          toast.error(t('signToasts.contractError', { name: vol.name })),
      });
      return;
    }
    if (doc.status === 'timesheet-signing-coord') {
      signInvoice.mutate(doc.id, {
        onSuccess: () =>
          toast.success(t('signToasts.invoice', { name: vol.name })),
        onError: () =>
          toast.error(t('signToasts.invoiceError', { name: vol.name })),
      });
    }
  }

  function handleDecline(pair: DocVolPair, reason: string) {
    const { doc, vol } = pair;
    if (doc.status.startsWith('contract')) {
      declineContract.mutate(
        { contractId: doc.id, reason },
        {
          onSuccess: () =>
            toast.success(t('declineToasts.contract', { name: vol.name })),
          onError: () =>
            toast.error(t('declineToasts.contractError', { name: vol.name })),
        },
      );
      return;
    }
    declineInvoice.mutate(
      { invoiceId: doc.id, reason },
      {
        onSuccess: () =>
          toast.success(t('declineToasts.invoice', { name: vol.name })),
        onError: () =>
          toast.error(t('declineToasts.invoiceError', { name: vol.name })),
      },
    );
  }

  // Derived for DocumentSheet
  const selectedDate = dateRange?.from ?? new Date();

  const tileLabels: Record<BoardTileId, string> = {
    all: t('tiles.all'),
    'contract-generate': t('tiles.contractGenerate'),
    'contract-signing': t('tiles.contractSigning'),
    'timesheet-generate': t('tiles.timesheetGenerate'),
    'timesheet-signing': t('tiles.timesheetSigning'),
    'ready-to-go': t('tiles.readyToGo'),
  };

  // Tile counts are pauschale-scoped only so selecting a tile does not shrink
  // every other tile's badge.
  const tileCounts = useMemo(
    () =>
      Object.fromEntries(
        BOARD_TILE_IDS.map((tileId) => [
          tileId,
          countForTile(
            volunteers,
            tileId,
            effectiveFilterSettings.pauschaleType,
          ),
        ]),
      ) as Record<BoardTileId, number>,
    [volunteers, effectiveFilterSettings.pauschaleType],
  );

  const tileActionableCounts = useMemo(
    () =>
      Object.fromEntries(
        BOARD_TILE_IDS.map((tileId) => [
          tileId,
          countActionableForTile(
            volunteers,
            tileId,
            effectiveFilterSettings.pauschaleType,
          ),
        ]),
      ) as Record<BoardTileId, number>,
    [volunteers, effectiveFilterSettings.pauschaleType],
  );

  // Tiles set documentType + nextAction together. Clicking the active
  // pipeline tile deselects back to All; changing documentType via the
  // dropdown always clears nextAction so the two cannot disagree.
  function toggleTile(tileId: BoardTileId) {
    setFilterSettings((prev) => {
      if (isTileActive({ ...prev, dateRange }, tileId) && tileId !== 'all') {
        return { ...prev, documentType: 'all', nextAction: 'any' };
      }
      const preset = BOARD_TILE_PRESETS[tileId];
      return {
        ...prev,
        documentType: preset.documentType,
        nextAction: preset.nextAction,
      };
    });
  }

  function handleDocTypeChange(next: DocumentTypeFilter) {
    setFilterSettings((prev) => ({
      ...prev,
      documentType: next,
      nextAction: 'any',
    }));
  }

  const filtersActive =
    effectiveFilterSettings.nextAction !== 'any' ||
    effectiveFilterSettings.documentType !== 'all' ||
    effectiveFilterSettings.volunteerName.trim() !== '';

  const allSelectableIds = useMemo(
    () => selectableDocIds(sortedFilteredVolunteers, effectiveFilterSettings),
    [sortedFilteredVolunteers, effectiveFilterSettings],
  );
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.has(id));
  const anySelected = selectedIds.size > 0;

  if (isLoading) {
    return <ReimbursementsBoardSkeleton />;
  }

  if (error) {
    return (
      <Empty className="border-border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon className="size-5 text-destructive" />
          </EmptyMedia>
          <EmptyTitle>{t('loadError')}</EmptyTitle>
          <EmptyDescription>{t('loadErrorHint')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker
          value={dateRange}
          onChange={onDateRangeChange}
          presets={[
            {
              key: 'all-time',
              label: t('periodPicker.fullYear'),
              range: undefined,
            },
            {
              key: 'this-month',
              label: t('periodPicker.thisMonth'),
              range: thisMonthRange(),
            },
            {
              key: 'last-month',
              label: t('periodPicker.lastMonth'),
              range: lastMonthRange(),
            },
          ]}
          placeholderLabel={t('periodPicker.fullYear')}
          applyLabel={t('periodPicker.apply')}
          customRangeLabel={t('periodPicker.customPeriod')}
          autoApplyPresets
          requireEndDate={false}
          align="start"
          className="h-10 gap-2 shrink-0"
        />
        <Select
          value={String(year)}
          onValueChange={(v) => onYearChange(Number(v))}
        >
          <SelectTrigger
            className="h-10 min-w-28 shrink-0"
            aria-label={t('yearLabel')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter tiles: All, then the pipeline steps — each sets documentType + nextAction */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {BOARD_TILE_IDS.map((tileId, i) => {
          const tile = BOARD_TILE_PRESETS[tileId];
          return (
            <Fragment key={tileId}>
              {i === 1 && (
                <div className="w-px self-stretch bg-border mx-3 shrink-0" />
              )}
              {i > 1 && (
                <div className="flex items-center px-1 shrink-0">
                  <ChevronRightIcon size={14} className="text-border" />
                </div>
              )}
              <FilterTile
                label={tileLabels[tileId]}
                count={tileCounts[tileId]}
                actionableCount={
                  tile.nextAction === 'generate' ||
                  tile.nextAction === 'countersign'
                    ? tileActionableCounts[tileId]
                    : undefined
                }
                active={isTileActive(effectiveFilterSettings, tileId)}
                onClick={() => toggleTile(tileId)}
              />
            </Fragment>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            placeholder={t('toolbar.searchPlaceholder')}
            value={filterSettings.volunteerName}
            onChange={(e) =>
              setFilterSettings((prev) => ({
                ...prev,
                volunteerName: e.target.value,
              }))
            }
            className="h-10 pl-9"
          />
        </div>

        <Select
          value={filterSettings.documentType}
          onValueChange={(v) => handleDocTypeChange(v as DocumentTypeFilter)}
        >
          <SelectTrigger className="h-10 min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.docTypeAll')}</SelectItem>
            <SelectItem value="contract">
              {t('filters.docTypeContracts')}
            </SelectItem>
            <SelectItem value="timesheet">
              {t('filters.docTypeTimesheets')}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterSettings.pauschaleType}
          onValueChange={(v) =>
            setFilterSettings((prev) => ({
              ...prev,
              pauschaleType: v as PauschaleTypeFilter,
            }))
          }
        >
          <SelectTrigger className="h-10 min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('toolbar.typeAll')}</SelectItem>
            <SelectItem value="ehrenamt">{t('toolbar.typeEP')}</SelectItem>
            <SelectItem value="uebungsleiter">{t('toolbar.typeUL')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOption}
          onValueChange={(v) => setSortOption(v as SortOption)}
        >
          <SelectTrigger className="h-10 min-w-40">
            <ArrowUpDownIcon size={14} className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="action-needed">
              {t('toolbar.sortActionNeeded')}
            </SelectItem>
            <SelectItem value="newest">{t('toolbar.sortNewest')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table / empty state */}
      {sortedFilteredVolunteers.length === 0 ? (
        <Empty className="border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {filtersActive ? (
                <FilterXIcon className="size-5 text-muted-foreground" />
              ) : (
                <CheckCircle2Icon className="size-5 text-success" />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {filtersActive ? t('empty.filtered') : t('empty.allDone')}
            </EmptyTitle>
            {!filtersActive && (
              <EmptyDescription>{t('empty.allDoneHint')}</EmptyDescription>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <ReimbursementsTable
          volunteers={sortedFilteredVolunteers}
          orgUId={orgUId}
          onDocumentClick={(doc, vol) => setSelectedDoc({ doc, vol })}
          onRequestCreate={handleRequestCreate}
          filterSettings={effectiveFilterSettings}
          canCreateDocuments={canCreateDocuments}
          templateReadiness={templateReadiness}
          selectedIds={selectedIds}
          onToggleDoc={toggleDoc}
          onToggleVolunteer={toggleVolunteer}
          onToggleAll={toggleAll}
          allSelected={allSelected}
          anySelected={anySelected}
          highlightedDocId={highlightedDocId}
          registerRowRef={registerRowRef}
        />
      )}

      <DocumentSheet
        doc={selectedDoc?.doc ?? null}
        vol={selectedDoc?.vol ?? null}
        open={selectedDoc !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDoc(null);
        }}
        onRequestCreate={handleRequestCreate}
        onRequestSign={handleSign}
        onDecline={handleDecline}
        selectedDate={selectedDate}
        orgUId={orgUId}
        canCreateDocuments={canCreateDocuments}
        templateReadiness={templateReadiness}
      />

      <ContractCreationModal
        open={contractCreationTarget !== null}
        onOpenChange={(open) => {
          if (!open) setContractCreationTarget(null);
        }}
        volunteerId={contractCreationTarget?.vol.id ?? null}
        volunteerName={contractCreationTarget?.vol.name ?? null}
        pauschale={
          contractCreationTarget ? contractCreationTarget.doc.pauschale : null
        }
        sourceDraftId={
          contractCreationTarget
            ? sourceDraftIdFor(contractCreationTarget.doc)
            : null
        }
        initialLifespan={
          contractCreationTarget
            ? initialLifespanFor(contractCreationTarget.doc)
            : null
        }
        onSent={() => setContractCreationTarget(null)}
      />

      <InvoiceCreationModal
        open={invoiceCreationTarget !== null}
        onOpenChange={(open) => {
          if (!open) setInvoiceCreationTarget(null);
        }}
        orgUId={orgUId}
        docId={invoiceCreationTarget?.doc.id ?? null}
        // A "to invoice" row opens on its month; a declined timesheet on the
        // period it was issued for, so its released hours are listed.
        initialPeriod={
          invoiceCreationTarget?.doc.periodStart &&
          invoiceCreationTarget.doc.periodEnd
            ? {
                start: invoiceCreationTarget.doc.periodStart,
                end: invoiceCreationTarget.doc.periodEnd,
              }
            : null
        }
        volunteerId={invoiceCreationTarget?.vol.id ?? null}
        volunteerName={invoiceCreationTarget?.vol.name ?? null}
        pauschale={
          invoiceCreationTarget ? invoiceCreationTarget.doc.pauschale : null
        }
        onSent={() => setInvoiceCreationTarget(null)}
      />

      <CreateDocumentModal
        open={createDocOpen}
        onOpenChange={onCreateDocOpenChange}
        orgUId={orgUId}
        volunteers={volunteers}
        onContractSent={() => {}}
        onInvoiceSent={() => {}}
        templateReadiness={templateReadiness}
      />

      <MassActionBar
        selectedCount={selectedIds.size}
        contractCount={resolvedSelectionCounts.contractCount}
        timesheetCount={resolvedSelectionCounts.timesheetCount}
        bundleCount={resolvedSelectionCounts.bundleCount}
        bundleMode={bundleMode}
        busyAction={busyAction}
        onCountersignContracts={() => void handleMassCountersignContracts()}
        onCountersignTimesheets={() => void handleMassCountersignTimesheets()}
        onSendBundles={() => void handleMassBundles()}
        onDeselectAll={() => toggleAll(false)}
      />

      <BundleBatchConfirmDialog
        open={batchDialogOpen}
        sendable={batchSendable}
        needsAttention={batchNeedsAttention}
        isSending={send.isPending}
        onOpenChange={(open) => {
          if (!open && !send.isPending) setBatchDialogOpen(false);
        }}
        onConfirm={(keysToSend) => void handleBatchConfirm(keysToSend)}
      />
    </div>
  );
}

// ─── Board skeleton ───────────────────────────────────────────────────────────

const TILE_SKELETON_KEYS = [
  'tile-1',
  'tile-2',
  'tile-3',
  'tile-4',
  'tile-5',
  'tile-6',
];
const ROW_SKELETON_KEYS = ['row-1', 'row-2', 'row-3'];

export function ReimbursementsBoardSkeleton() {
  return (
    <div className="space-y-6 pb-24">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TILE_SKELETON_KEYS.map((key, i) => (
          <Fragment key={key}>
            {i > 0 && (
              <div className="flex items-center px-1">
                <Skeleton className="h-3 w-3" />
              </div>
            )}
            <div className="flex min-w-[160px] flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Fragment>
        ))}
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-9 flex-1 min-w-48" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {ROW_SKELETON_KEYS.map((key) => (
          <div
            key={key}
            className="flex items-center gap-3 border-b border-border px-4 py-3"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

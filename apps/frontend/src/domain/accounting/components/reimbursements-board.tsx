'use client';

import {
  useDeclineContract,
  useDeclineInvoice,
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
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useReimbursementBoardData } from '../hooks/use-reimbursement-board-data';
import {
  creationTargetFor,
  initialLifespanFor,
  sourceDraftIdFor,
} from '../lib/board-data.utils';
import { docVisibleInRange, matchesTile } from '../lib/board-filters';
import { isYourActionStatus } from '../lib/board-status';
import type {
  BoardVolunteer,
  DocTypeFilter,
  DocVolPair,
  TileFilter,
} from '../lib/board-types';
import {
  documentCreationBlockedFor,
  type TemplateReadinessByPauschale,
} from '../lib/setup-status';
import { ContractCreationModal } from './contract-creation-modal';
import { CreateDocumentModal } from './create-document-modal';
import type { PauschalenType } from './doc-type-header';
import { InvoiceCreationModal } from './invoice-creation-modal';
import type { DateRange } from './period-picker';
import { lastMonthRange, PeriodPicker, thisMonthRange } from './period-picker';
import { DocumentSheet } from './reimbursements-document-sheet';
import { ReimbursementsTable } from './reimbursements-volunteer-group';

type PauschalenFilter = 'all' | PauschalenType;
type SortOption = 'action-needed' | 'newest';

const TILE_IDS: TileFilter[] = [
  'all',
  'contract-generate',
  'contract-signing',
  'timesheet-generate',
  'timesheet-signing',
  'ready-to-go',
];

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

/** How many of a tile's matching docs are actionable by the org right now (vs. waiting on the volunteer). Only meaningful for the mixed-substep signing / generate tiles. */
function countActionableForTile(
  volunteers: BoardVolunteer[],
  tile: TileFilter,
): number {
  return volunteers.reduce(
    (sum, vol) =>
      sum +
      vol.documents.filter(
        (d) => matchesTile(d.status, tile) && isYourActionStatus(d.status),
      ).length,
    0,
  );
}

const TILE_DOC_TYPE: Record<TileFilter, DocTypeFilter> = {
  all: 'all',
  'contract-generate': 'contract',
  'contract-signing': 'contract',
  'timesheet-generate': 'timesheet',
  'timesheet-signing': 'timesheet',
  // Ready-to-go is the terminal bundling stage — leave the doc-type filter
  // on "all"; the tile's own row-builder (getReadyToGoDocs) scopes the
  // table to ready timesheets + their contract row, not this dropdown.
  'ready-to-go': 'all',
};

function countForTile(volunteers: BoardVolunteer[], tile: TileFilter): number {
  return volunteers.reduce(
    (sum, vol) =>
      sum + vol.documents.filter((d) => matchesTile(d.status, tile)).length,
    0,
  );
}

/**
 * Decides which volunteers show, without ever touching `vol.documents` —
 * compliance checks (and the table itself) always read the true, unfiltered
 * document list; only *inclusion* is filtered here, and *display* is
 * filtered separately per-document (see `docVisibleInRange` and
 * `getReadyToGoDocs`) so a volunteer's real data is never corrupted by the
 * current view.
 */
function applyFilters(
  volunteers: BoardVolunteer[],
  tile: TileFilter,
  pauschale: PauschalenFilter,
  docType: DocTypeFilter,
  search: string,
  range: DateRange | undefined,
): BoardVolunteer[] {
  const filteredVolunteers = volunteers.filter((volunteer) => {
    if (volunteer.documents.length === 0) return false;
    if (
      pauschale !== 'all' &&
      !volunteer.documents.some((d) => d.pauschale === pauschale)
    )
      return false;
    if (search && !volunteer.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (
      tile !== 'all' &&
      !volunteer.documents.some((d) => matchesTile(d.status, tile))
    )
      return false;
    if (
      docType !== 'all' &&
      !volunteer.documents.some((d) => d.status.startsWith(docType))
    )
      return false;
    if (
      range?.from &&
      !volunteer.documents.some((d) => docVisibleInRange(d, range))
    )
      return false;
    return true;
  });
  return filteredVolunteers;
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

  // Filters
  const [activeTile, setActiveTile] = useState<TileFilter>('all');

  const [pauschale, setPauschale] = useState<PauschalenFilter>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('action-needed');

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
    if (doc.status === 'contract-signing-admin') {
      signContract.mutate(doc.id, {
        onSuccess: () =>
          toast.success(t('signToasts.contract', { name: vol.name })),
        onError: () =>
          toast.error(t('signToasts.contractError', { name: vol.name })),
      });
      return;
    }
    if (doc.status === 'timesheet-signing-admin') {
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

  const tileLabels: Record<TileFilter, string> = {
    all: t('tiles.all'),
    'contract-generate': t('tiles.contractGenerate'),
    'contract-signing': t('tiles.contractSigning'),
    'timesheet-generate': t('tiles.timesheetGenerate'),
    'timesheet-signing': t('tiles.timesheetSigning'),
    'ready-to-go': t('tiles.readyToGo'),
  };

  // Tile counts are pauschale-scoped only. docTypeFilter is not an
  // independent user choice here — selecting a tile sets it as a side
  // effect (TILE_DOC_TYPE) — so letting it narrow this list would make every
  // tile's count shrink whenever any one tile is selected, instead of
  // reflecting the org's true, stable totals.
  const volunteersWithDocumentsOfSelectedPauschale = useMemo(
    () =>
      volunteers.filter((v) => {
        if (pauschale === 'all') return true;
        return v.documents.some((d) => d.pauschale === pauschale);
      }),
    [volunteers, pauschale],
  );

  const tileCounts = useMemo(
    () =>
      Object.fromEntries(
        TILE_IDS.map((id) => [
          id,
          countForTile(volunteersWithDocumentsOfSelectedPauschale, id),
        ]),
      ) as Record<TileFilter, number>,
    [volunteersWithDocumentsOfSelectedPauschale],
  );

  const tileActionableCounts = useMemo(
    () =>
      Object.fromEntries(
        TILE_IDS.map((id) => [
          id,
          countActionableForTile(
            volunteersWithDocumentsOfSelectedPauschale,
            id,
          ),
        ]),
      ) as Record<TileFilter, number>,
    [volunteersWithDocumentsOfSelectedPauschale],
  );

  const filteredVolunteers = useMemo(
    () =>
      applyFilters(
        volunteers,
        activeTile,
        pauschale,
        docTypeFilter,
        search,
        dateRange,
      ),
    [volunteers, activeTile, pauschale, docTypeFilter, search, dateRange],
  );

  const sortedFilteredVolunteers = useMemo(
    () => sortVolunteers(filteredVolunteers, sortOption),
    [filteredVolunteers, sortOption],
  );

  // Tabs are married to the doc-type filter: picking a tile sets the matching
  // doc type (or "all" for the All tile); changing the doc type manually
  // always resets the tile back to All, so the two controls can never
  // disagree and silently zero out the table.
  // Clicking All always selects it; clicking the active pipeline tile
  // deselects back to All.
  function toggleTile(tile: TileFilter) {
    setActiveTile((prev) => {
      const next: TileFilter = prev === tile ? 'all' : tile;
      setDocTypeFilter(TILE_DOC_TYPE[next]);
      return next;
    });
  }

  function handleDocTypeChange(next: DocTypeFilter) {
    setDocTypeFilter(next);
    setActiveTile('all');
  }

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

      {/* Filter tiles: All, then the pipeline steps */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {TILE_IDS.map((id, i) => (
          <Fragment key={id}>
            {i === 1 && (
              <div className="w-px self-stretch bg-border mx-3 shrink-0" />
            )}
            {i > 1 && (
              <div className="flex items-center px-1 shrink-0">
                <ChevronRightIcon size={14} className="text-border" />
              </div>
            )}
            <FilterTile
              label={tileLabels[id]}
              count={tileCounts[id]}
              actionableCount={
                id === 'contract-generate' ||
                id === 'timesheet-generate' ||
                id === 'contract-signing' ||
                id === 'timesheet-signing'
                  ? tileActionableCounts[id]
                  : undefined
              }
              active={activeTile === id}
              onClick={() => toggleTile(id)}
            />
          </Fragment>
        ))}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>

        <Select
          value={docTypeFilter}
          onValueChange={(v) => handleDocTypeChange(v as DocTypeFilter)}
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
          value={pauschale}
          onValueChange={(v) => setPauschale(v as PauschalenFilter)}
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
              {activeTile !== 'all' || search ? (
                <FilterXIcon className="size-5 text-muted-foreground" />
              ) : (
                <CheckCircle2Icon className="size-5 text-success" />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {activeTile !== 'all' || search
                ? t('empty.filtered')
                : t('empty.allDone')}
            </EmptyTitle>
            {activeTile === 'all' && !search && (
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
          docTypeFilter={docTypeFilter}
          dateRange={dateRange}
          activeTile={activeTile}
          canCreateDocuments={canCreateDocuments}
          templateReadiness={templateReadiness}
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

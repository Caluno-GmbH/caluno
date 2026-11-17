'use client';

import {
  type BundleDeliveryIssue,
  BundleDeliveryMethod,
  DataError,
} from '@repo/data';
import {
  useAccountingDeliverySettings,
  useBundleDownloadStatus,
  useBundleSendPreview,
  useQueryClient,
  useSendReimbursementBundle,
} from '@repo/data/react';
import {
  Button,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { ChevronDownIcon, FileTextIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/constants';
import { formatEuro } from '@/lib/formatting/formats';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { documentRowAction } from '../lib/board-data.utils';
import {
  isTimesheetNonCompliant,
  visibleDocumentsForVolunteer,
} from '../lib/board-filters';
import { STATUS_META } from '../lib/board-status';
import type {
  BoardDocument,
  BoardVolunteer,
  DocStatus,
  DocVolPair,
  FilterSettings,
  PauschalenLimit,
  SendState,
} from '../lib/board-types';
import { reportBundleDownloadFailure } from '../lib/report-bundle-download-failure';
import {
  documentCreationBlockedFor,
  type TemplateReadinessByPauschale,
} from '../lib/setup-status';
import { AlertIconTooltip } from './alert-icon-tooltip';
import { BundleSendConfirmDialog } from './bundle-send-confirm-dialog';
import type { PauschalenType } from './doc-type-header';
import { DocTypeHeader, getPauschaleKey } from './doc-type-header';
import { LimitHeadroomBar } from './limit-headroom-bar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "Julia Vorstand" -> "J. Vorstand" */
function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const [first, ...rest] = parts;
  return `${first?.[0] ?? ''}. ${rest.join(' ')}`;
}

const STATUS_SORT_ORDER: DocStatus[] = [
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

// ─── Bundle actions ───────────────────────────────────────────────────────────

interface ShownBundle {
  issues: BundleDeliveryIssue[];
  recipientEmail: string;
  subject: string;
}

interface BundleButtonProps {
  volunteerId: string;
  reimbursementTypeId: string | undefined;
  typeLabel: string;
  readyCount: number;
  /** The timesheets on screen, so the bundle holds exactly those. */
  invoiceIds: string[];
  orgUId: string;
  volunteerName: string;
  lastSent?: { at: Date; by?: string; state?: SendState };
}

function useBundleDownload({
  volunteerId,
  reimbursementTypeId,
  invoiceIds,
  orgUId,
  readyCount,
}: Pick<
  BundleButtonProps,
  'volunteerId' | 'reimbursementTypeId' | 'invoiceIds' | 'orgUId' | 'readyCount'
>) {
  const t = useTranslations('Accounting.reimbursements');
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async () => {
    if (!reimbursementTypeId || isDownloading) return;
    const url =
      `${API_URL}/accounting/reimbursement-bundle/download` +
      `?volunteerId=${encodeURIComponent(volunteerId)}` +
      `&reimbursementTypeId=${encodeURIComponent(reimbursementTypeId)}` +
      `&invoiceIds=${encodeURIComponent(invoiceIds.join(','))}`;
    setIsDownloading(true);
    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'x-organization-unit-id': orgUId },
      });
      if (!response.ok) {
        toast.error(t('bundle.downloadError'));
        void reportBundleDownloadFailure(response, {
          volunteerId,
          reimbursementTypeId,
        });
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `Abrechnung-${volunteerId.slice(0, 8)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      // The bundle download records the audit row and marks the READY
      // invoices as paid, so refresh the board + "last downloaded" hint.
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      toast.success(t('batchBar.bundleDownloadToast', { count: readyCount }));
    } catch (error) {
      toast.error(t('bundle.downloadError'));
      void reportBundleDownloadFailure(error, {
        volunteerId,
        reimbursementTypeId,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading };
}

/** Own component (not inlined in the readyTypes.map()) because it calls hooks. */
function BundleActionButton(props: BundleButtonProps) {
  const t = useTranslations('Accounting.reimbursements');
  const settingsQuery = useAccountingDeliverySettings(props.orgUId);
  const settings = settingsQuery.data;

  // Until the method is known, neither action: a download in an email unit
  // would hand the bundle over the wrong way and mark it paid.
  if (!settings) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[220px]">
        <Button size="sm" variant="outline" className="shrink-0" disabled>
          {settingsQuery.isError
            ? t('bundle.settingsError')
            : `${t('bundle.actionLabel')} · ${props.readyCount}`}
        </Button>
      </div>
    );
  }
  // Without a resolved address an email unit falls back to downloading, so
  // ready bundles are never stuck.
  if (
    settings.deliveryMethod === BundleDeliveryMethod.Email &&
    settings.recipientEmail
  ) {
    return <BundleSendButton {...props} />;
  }
  return <BundleDownloadButton {...props} />;
}

function BundleSendButton(props: BundleButtonProps) {
  const {
    volunteerId,
    reimbursementTypeId,
    typeLabel,
    readyCount,
    invoiceIds,
    volunteerName,
    lastSent,
  } = props;
  const t = useTranslations('Accounting.reimbursements');
  const { formatDate } = useFormatting();
  const preview = useBundleSendPreview();
  const send = useSendReimbursementBundle();
  const { download, isDownloading } = useBundleDownload(props);
  const [confirm, setConfirm] = useState<ShownBundle | null>(null);
  const isBusy = preview.isPending || send.isPending || isDownloading;

  const offerDownload = () =>
    toast.error(t('bundle.sendTooLarge'), {
      action: {
        label: t('bundle.downloadInstead'),
        onClick: () => void download(),
      },
    });

  const handleSendError = (error: unknown) => {
    const code = error instanceof DataError ? error.options?.code : undefined;
    if (code === 'UNPROCESSABLE_ENTITY') return offerDownload();
    toast.error(
      code === 'CONFLICT'
        ? t('bundle.sendIssuesChanged')
        : t('bundle.sendError'),
    );
  };

  const sendBundle = async (shown: ShownBundle) => {
    if (!reimbursementTypeId) return;
    try {
      await send.mutateAsync({
        volunteerId,
        reimbursementTypeId,
        invoiceIds,
        acknowledgedIssues: shown.issues,
        expectedRecipientEmail: shown.recipientEmail,
        expectedSubject: shown.subject,
      });
      toast.success(t('bundle.sendSuccess'));
    } catch (error) {
      handleSendError(error);
    } finally {
      setConfirm(null);
    }
  };

  const startSend = async () => {
    if (!reimbursementTypeId || isBusy) return;
    try {
      const result = await preview.mutateAsync({
        volunteerId,
        reimbursementTypeId,
        invoiceIds,
      });
      if (!result.fitsInEmail) return offerDownload();
      if (!result.recipientEmail) {
        toast.error(t('bundle.noRecipient'));
        return;
      }
      const shown = {
        issues: result.issues,
        recipientEmail: result.recipientEmail,
        subject: result.subject,
      };
      if (shown.issues.length > 0) {
        setConfirm(shown);
        return;
      }
      await sendBundle(shown);
    } catch (error) {
      handleSendError(error);
    }
  };

  const lastSentLine = () => {
    if (!lastSent) return t('bundle.neverSent');
    const at = formatDate(lastSent.at);
    if (lastSent.state === 'failed') return t('bundle.lastSendFailed', { at });
    if (lastSent.state === 'pending') return t('bundle.lastSending');
    return t('bundle.lastSent', {
      by: lastSent.by ? abbreviateName(lastSent.by) : t('bundle.unknownUser'),
      at,
    });
  };

  return (
    <div className="flex flex-col items-end gap-1 max-w-[220px]">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        disabled={!reimbursementTypeId || isBusy}
        onClick={(e) => {
          e.stopPropagation();
          void startSend();
        }}
      >
        <SendIcon size={13} />
        {t('bundle.sendActionLabel')} · {readyCount}
      </Button>
      <span
        className={cn(
          'text-xs text-right leading-snug',
          lastSent?.state === 'failed' ? 'text-alert' : 'text-muted-foreground',
        )}
      >
        <span className="font-medium text-card-foreground">{typeLabel}</span> ·{' '}
        {lastSentLine()}
      </span>
      {/* The dialog portals out, but React events still bubble to the row. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops row toggling only */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops row toggling only */}
      <div onClick={(e) => e.stopPropagation()}>
        <BundleSendConfirmDialog
          open={confirm !== null}
          volunteerName={volunteerName}
          recipientEmail={confirm?.recipientEmail ?? ''}
          issues={confirm?.issues ?? []}
          isSending={send.isPending}
          onOpenChange={(open) => {
            if (!open && !send.isPending) setConfirm(null);
          }}
          onConfirm={() => confirm && void sendBundle(confirm)}
        />
      </div>
    </div>
  );
}

function BundleDownloadButton(props: BundleButtonProps) {
  const { volunteerId, reimbursementTypeId, typeLabel, readyCount } = props;
  const t = useTranslations('Accounting.reimbursements');
  const { formatDate } = useFormatting();
  const { data: status, isLoading } = useBundleDownloadStatus(
    volunteerId,
    reimbursementTypeId,
  );
  const { download, isDownloading } = useBundleDownload(props);

  return (
    <div className="flex flex-col items-end gap-1 max-w-[220px]">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        disabled={!reimbursementTypeId || isDownloading}
        onClick={(e) => {
          e.stopPropagation();
          void download();
        }}
      >
        <FileTextIcon size={13} />
        {t('bundle.actionLabel')} · {readyCount}
      </Button>
      <span className="text-xs text-muted-foreground text-right leading-snug">
        <span className="font-medium text-card-foreground">{typeLabel}</span> ·{' '}
        {isLoading
          ? null
          : status
            ? t.rich('bundle.lastDownloaded', {
                by: status.downloadedByUser?.name
                  ? abbreviateName(status.downloadedByUser.name)
                  : t('bundle.unknownUser'),
                at: formatDate(new Date(status.downloadedAt)),
                // Stubbed: no volunteer-profile route exists yet
                // in this prototype — becomes a real link there.
                name: (chunks) => (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {chunks}
                  </button>
                ),
              })
            : t('bundle.neverDownloaded')}
      </span>
    </div>
  );
}

// ─── VolunteerTableGroup ──────────────────────────────────────────────────────

interface VolunteerTableGroupProps {
  volunteer: BoardVolunteer;
  orgUId: string;
  onDocumentClick: (doc: BoardDocument, vol: BoardVolunteer) => void;
  onRequestCreate: (pair: DocVolPair) => void;
  filterSettings: FilterSettings;
  canCreateDocuments: boolean;
  templateReadiness: TemplateReadinessByPauschale;
}

function VolunteerTableGroup({
  volunteer,
  orgUId,
  onDocumentClick,
  onRequestCreate,
  filterSettings,
  canCreateDocuments,
  templateReadiness,
}: VolunteerTableGroupProps) {
  const t = useTranslations('Accounting.reimbursements');
  const tSections = useTranslations('Accounting.templates.sections');
  const { formatDate } = useFormatting();
  const [isOpen, setIsOpen] = useState(true);

  // Ready-to-go (`nextAction: 'send'`) gets its own row set; every other
  // combination filters real documents via FilterSettings without mutating
  // `vol.documents`, so compliance checks stay accurate regardless of view.
  const visibleDocs = visibleDocumentsForVolunteer(volunteer, filterSettings);

  const sortedDocs = [...visibleDocs].sort(
    (a, b) =>
      STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status),
  );

  if (sortedDocs.length === 0) return null;

  // Ready timesheets bundle separately per pauschale type — never combined
  // into one download, since each type is its own reimbursement batch.
  const readyByType: Partial<Record<PauschalenType, number>> = {};
  const readyIdsByType: Partial<Record<PauschalenType, string[]>> = {};
  const lastSentByType: Partial<
    Record<PauschalenType, { at: Date; by?: string; state?: SendState }>
  > = {};
  for (const d of sortedDocs) {
    if (d.status !== 'timesheet-ready') continue;
    const type = d.pauschale;
    readyByType[type] = (readyByType[type] ?? 0) + 1;
    readyIdsByType[type] = [...(readyIdsByType[type] ?? []), d.id];
    const latest = lastSentByType[type];
    if (d.sentAt && (!latest || d.sentAt > latest.at)) {
      lastSentByType[type] = {
        at: d.sentAt,
        by: d.sentBy,
        state: d.sendState,
      };
    }
  }
  const readyTypes = Object.keys(readyByType) as PauschalenType[];
  const TYPE_LABEL: Record<PauschalenType, string> = {
    ehrenamt: t('toolbar.typeEP'),
    uebungsleiter: t('toolbar.typeUL'),
  };

  return (
    <>
      {/* Volunteer group header */}
      <TableRow
        className={cn(
          'cursor-pointer select-none border-t border-border/60 hover:bg-muted/40',
          'bg-muted/20',
        )}
        onClick={() => setIsOpen((o) => !o)}
      >
        <TableCell className="align-middle overflow-hidden py-4">
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-medium text-card-foreground truncate">
                {volunteer.name}
              </span>
            </div>
            {volunteer.limits && Object.keys(volunteer.limits).length > 1 ? (
              <div className="flex flex-col gap-1 mt-1">
                {(
                  Object.entries(volunteer.limits) as [
                    PauschalenType,
                    PauschalenLimit,
                  ][]
                ).map(([type, lim]) => (
                  <LimitHeadroomBar
                    key={type}
                    used={lim.used}
                    total={lim.total}
                    density="text"
                  />
                ))}
              </div>
            ) : (
              <LimitHeadroomBar
                used={volunteer.usedAmount}
                total={volunteer.totalCap}
                density="text"
                className="mt-1"
              />
            )}
          </div>
        </TableCell>

        <TableCell className="align-middle py-4" />

        <TableCell className="align-middle py-4" />
        <TableCell className="align-middle py-4" />

        <TableCell className="align-middle py-4">
          {/* Bundle buttons stop propagation; chevron lets click through to row */}
          <div className="flex items-center gap-3 justify-end">
            {readyTypes.length > 0 && (
              <div className="flex flex-col items-end gap-3">
                {readyTypes.map((type) => (
                  <BundleActionButton
                    key={type}
                    volunteerId={volunteer.id}
                    reimbursementTypeId={volunteer.reimbursementTypeIds?.[type]}
                    typeLabel={TYPE_LABEL[type]}
                    readyCount={readyByType[type] ?? 0}
                    invoiceIds={readyIdsByType[type] ?? []}
                    orgUId={orgUId}
                    volunteerName={volunteer.name}
                    lastSent={lastSentByType[type]}
                  />
                ))}
              </div>
            )}
            <ChevronDownIcon
              size={16}
              className={cn(
                'text-muted-foreground transition-transform duration-200 shrink-0',
                isOpen && 'rotate-180',
              )}
            />
          </div>
        </TableCell>
      </TableRow>

      {/* Document rows */}
      {isOpen &&
        sortedDocs.map((doc) => {
          const meta = STATUS_META[doc.status];
          const actionKey = meta.actionKey;
          const isActive = doc.status === 'contract-active';
          const isTimesheet = doc.status.startsWith('timesheet');
          const isGenerate =
            doc.status === 'contract-generate' ||
            doc.status === 'timesheet-generate';
          const isDraft = doc.status === 'contract-draft';
          // Contract-generate has nothing to show yet (no signing chain has
          // started); timesheet-generate already has computed hours/amount.
          const rowAction = documentRowAction(doc);
          const effectivePauschale = doc.pauschale;
          // Sent (or on its way) outranks the warnings: a faulty timesheet
          // that went to accounting was sent on purpose. A failed send was
          // not delivered, so its warnings stay.
          const sendState =
            isTimesheet && doc.sentAt ? doc.sendState : undefined;
          const sendFailed = sendState === 'failed';
          const sending = sendState === 'pending';
          const sentAt = sendState === 'sent' ? doc.sentAt : undefined;
          const docNonCompliant =
            !sentAt && !sending && isTimesheetNonCompliant(doc);
          const createBlocked =
            actionKey === 'create' &&
            documentCreationBlockedFor(
              templateReadiness,
              effectivePauschale,
              isTimesheet ? 'invoice' : 'contract',
            );
          const canOpenSheet = rowAction !== 'none' && !createBlocked;
          const isDeclined =
            doc.status === 'contract-declined' ||
            doc.status === 'timesheet-declined';

          return (
            <TableRow
              key={doc.id}
              className={cn(
                'transition-colors',
                canOpenSheet
                  ? 'cursor-pointer hover:bg-muted/30'
                  : 'cursor-default',
                !isActive && !meta.isYourAction && !isGenerate && 'bg-muted/20',
              )}
              onClick={() => {
                if (rowAction === 'create') {
                  if (createBlocked) return;
                  onRequestCreate({ doc, vol: volunteer });
                  return;
                }
                if (rowAction === 'open') onDocumentClick(doc, volunteer);
              }}
            >
              <TableCell
                className={cn(
                  'pl-6 py-3 align-top overflow-hidden',
                  (isGenerate || isDraft) && 'opacity-40',
                )}
              >
                <DocTypeHeader
                  kind={isTimesheet ? 'invoice' : 'contract'}
                  pauschale={effectivePauschale}
                  topLine={doc.periodLabel}
                  name={`${t(
                    `docs.kindLabel.${isTimesheet ? 'timesheet' : 'contract'}` as Parameters<
                      typeof t
                    >[0],
                  )} ${tSections(
                    getPauschaleKey(effectivePauschale) as Parameters<
                      typeof tSections
                    >[0],
                  )}`}
                />
              </TableCell>

              <TableCell className="py-3 align-top text-left">
                <div className="flex flex-col gap-1">
                  {sendFailed && doc.sentAt && (
                    <span className="text-sm text-alert">
                      {t('docs.statusLabel.sendFailed', {
                        at: formatDate(doc.sentAt),
                      })}
                    </span>
                  )}
                  {sending && (
                    <span className="text-sm text-muted-foreground">
                      {t('docs.statusLabel.sending')}
                    </span>
                  )}
                  {sentAt && (
                    <span className="text-sm text-muted-foreground">
                      {t('docs.statusLabel.sentBy', {
                        by: doc.sentBy
                          ? abbreviateName(doc.sentBy)
                          : t('bundle.unknownUser'),
                        at: formatDate(sentAt),
                      })}
                    </span>
                  )}
                  {docNonCompliant && (
                    <span className="text-sm text-alert">
                      {t(
                        'docs.statusLabel.nonCompliant' as Parameters<
                          typeof t
                        >[0],
                      )}
                    </span>
                  )}
                  {doc.isOverCap && !sentAt && !sending && (
                    <span className="text-sm text-destructive">
                      {t('docs.statusLabel.overCap' as Parameters<typeof t>[0])}
                    </span>
                  )}
                  {isGenerate && !doc.isOverCap && (
                    <span className="text-sm text-muted-foreground">
                      {t(
                        'docs.statusLabel.notYetCreated' as Parameters<
                          typeof t
                        >[0],
                      )}
                    </span>
                  )}
                  {doc.status === 'contract-missing' && (
                    <span className="text-sm text-muted-foreground">
                      {t(
                        'docs.statusLabel.contractMissing' as Parameters<
                          typeof t
                        >[0],
                      )}
                    </span>
                  )}
                  {doc.status === 'timesheet-muted' && (
                    <span className="text-sm text-muted-foreground">
                      {t(
                        'docs.statusLabel.timesheetMuted' as Parameters<
                          typeof t
                        >[0],
                      )}
                    </span>
                  )}
                  {isDeclined && (
                    <span className="text-sm font-medium text-alert">
                      {t(
                        'docs.statusLabel.declined' as Parameters<typeof t>[0],
                      )}
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell className="py-3 align-top text-right">
                {isTimesheet && doc.hours !== undefined && (
                  <span className="text-sm tabular-nums text-card-foreground">
                    {doc.hours}h
                  </span>
                )}
              </TableCell>

              <TableCell className="py-3 align-top text-right">
                {isTimesheet && doc.amount !== undefined && (
                  <span className="text-sm font-medium tabular-nums text-card-foreground">
                    {formatEuro(doc.amount)}
                  </span>
                )}
              </TableCell>

              <TableCell className="py-3 align-top">
                <div className="flex items-center justify-end gap-2">
                  {docNonCompliant && actionKey && (
                    <AlertIconTooltip
                      hint={t(
                        'docs.statusLabel.nonCompliantHint' as Parameters<
                          typeof t
                        >[0],
                      )}
                      className="text-alert"
                    />
                  )}
                  {createBlocked && (
                    <AlertIconTooltip
                      hint={t(
                        'docs.statusLabel.templateMissingHint' as Parameters<
                          typeof t
                        >[0],
                      )}
                      className="text-alert"
                    />
                  )}
                  {isDeclined && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDocumentClick(doc, volunteer);
                      }}
                    >
                      {t('docs.actions.seeDetails' as Parameters<typeof t>[0])}
                    </Button>
                  )}
                  {!isActive && !isDeclined && actionKey && (
                    <Button
                      size="sm"
                      variant={actionKey === 'create' ? 'default' : 'outline'}
                      disabled={
                        actionKey === 'create' &&
                        (!canCreateDocuments || createBlocked)
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (actionKey === 'create') {
                          if (!canCreateDocuments || createBlocked) return;
                          onRequestCreate({ doc, vol: volunteer });
                        } else {
                          onDocumentClick(doc, volunteer);
                        }
                      }}
                    >
                      {t(
                        `docs.actions.${actionKey}` as Parameters<typeof t>[0],
                      )}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}

// ─── ReimbursementsTable ──────────────────────────────────────────────────────

interface ReimbursementsTableProps {
  volunteers: BoardVolunteer[];
  orgUId: string;
  onDocumentClick: (doc: BoardDocument, vol: BoardVolunteer) => void;
  onRequestCreate: (pair: DocVolPair) => void;
  filterSettings: FilterSettings;
  canCreateDocuments: boolean;
  templateReadiness: TemplateReadinessByPauschale;
}

export function ReimbursementsTable({
  volunteers,
  orgUId,
  onDocumentClick,
  onRequestCreate,
  filterSettings,
  canCreateDocuments,
  templateReadiness,
}: ReimbursementsTableProps) {
  const t = useTranslations('Accounting.reimbursements');

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table className="table-fixed min-w-[860px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-52">{t('tableHead.volunteer')}</TableHead>
            <TableHead className="w-36">{t('tableHead.status')}</TableHead>
            <TableHead className="w-14 text-right">
              {t('tableHead.hours')}
            </TableHead>
            <TableHead className="w-24 text-right">
              {t('tableHead.amount')}
            </TableHead>
            <TableHead className="w-36 text-right">
              {t('tableHead.action')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {volunteers.map((vol) => (
            <VolunteerTableGroup
              key={vol.id}
              volunteer={vol}
              orgUId={orgUId}
              onDocumentClick={onDocumentClick}
              onRequestCreate={onRequestCreate}
              filterSettings={filterSettings}
              canCreateDocuments={canCreateDocuments}
              templateReadiness={templateReadiness}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

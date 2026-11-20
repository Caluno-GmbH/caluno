'use client';

import type { BundleDeliveryIssue } from '@repo/data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Checkbox,
} from '@repo/ui';
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { BundleGroup } from '../lib/mass-actions';

interface SendableBundle {
  group: BundleGroup;
  recipientEmail: string;
  issues: BundleDeliveryIssue[];
}

interface BundleBatchConfirmDialogProps {
  open: boolean;
  sendable: SendableBundle[];
  needsAttention: {
    group: BundleGroup;
    reason: 'no-recipient' | 'too-large';
  }[];
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (keysToSend: string[]) => void;
}

const PAUSCHALE_TYPE_KEY = {
  ehrenamt: 'toolbar.typeEP',
  uebungsleiter: 'toolbar.typeUL',
} as const;

const keyOf = (group: BundleGroup) =>
  `${group.volunteerId}::${group.pauschale}`;

export function BundleBatchConfirmDialog({
  open,
  sendable,
  needsAttention,
  isSending,
  onOpenChange,
  onConfirm,
}: BundleBatchConfirmDialogProps) {
  const t = useTranslations('Accounting.reimbursements.massActions.confirm');
  const tBoard = useTranslations('Accounting.reimbursements');
  const tBundle = useTranslations('Accounting.reimbursements.bundle');

  // Clean bundles send by default; flagged bundles are opt-in per row.
  const clean = sendable.filter(({ issues }) => issues.length === 0);
  const flagged = sendable.filter(({ issues }) => issues.length > 0);

  const [optedIn, setOptedIn] = useState<Set<string>>(new Set());
  // Reset opt-ins whenever the dialog opens, so a fresh send never inherits a
  // stale acknowledgement from a previous batch.
  useEffect(() => {
    if (open) setOptedIn(new Set());
  }, [open]);

  function toggleOptIn(key: string, next: boolean) {
    setOptedIn((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(key);
      else updated.delete(key);
      return updated;
    });
  }

  const keysToSend = [
    ...clean.map(({ group }) => keyOf(group)),
    ...flagged
      .filter(({ group }) => optedIn.has(keyOf(group)))
      .map(({ group }) => keyOf(group)),
  ];
  const sendCount = keysToSend.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        {clean.length > 0 && (
          <ul className="space-y-3">
            {clean.map(({ group, recipientEmail }) => (
              <li
                key={keyOf(group)}
                className="space-y-2 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-foreground">
                    {group.volunteerName}
                  </p>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {t('docCount', { count: group.invoiceIds.length })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant="neutral">
                    {tBoard(PAUSCHALE_TYPE_KEY[group.pauschale])}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t('recipientLine', { email: recipientEmail })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {flagged.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t('issuesGroupLabel')}
            </p>
            <ul className="space-y-3">
              {flagged.map(({ group, recipientEmail, issues }) => {
                const key = keyOf(group);
                const checked = optedIn.has(key);
                const checkboxId = `send-anyway-${group.volunteerId}-${group.pauschale}`;
                return (
                  <li
                    key={key}
                    className="space-y-2 rounded-lg border border-alert/40 bg-alert/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">
                        {group.volunteerName}
                      </p>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {t('docCount', { count: group.invoiceIds.length })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge variant="neutral">
                        {tBoard(PAUSCHALE_TYPE_KEY[group.pauschale])}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('recipientLine', { email: recipientEmail })}
                      </span>
                    </div>
                    <ul className="space-y-1.5 rounded-md bg-alert/10 p-2.5">
                      {[...new Set(issues)].map((issue) => (
                        <li
                          key={issue}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <TriangleAlertIcon
                            size={16}
                            className="mt-0.5 shrink-0 text-alert"
                            aria-hidden="true"
                          />
                          <span>
                            {tBundle(`confirmDialog.issues.${issue}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <label
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={isSending}
                        onCheckedChange={(v) => toggleOptIn(key, v === true)}
                      />
                      {t('sendAnyway')}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {needsAttention.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t('needsAttentionLabel')}
            </p>
            <ul className="space-y-3">
              {needsAttention.map(({ group, reason }) => (
                <li
                  key={keyOf(group)}
                  className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <p className="text-base font-semibold text-foreground">
                    {group.volunteerName}
                  </p>
                  <Badge variant="neutral">
                    {tBoard(PAUSCHALE_TYPE_KEY[group.pauschale])}
                  </Badge>
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <TriangleAlertIcon
                      size={16}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {reason === 'no-recipient'
                        ? tBundle('noRecipient')
                        : tBundle('sendTooLarge')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-col sm:items-stretch">
          <AlertDialogAction
            className="w-full"
            disabled={isSending || sendCount === 0}
            onClick={(e) => {
              e.preventDefault();
              onConfirm(keysToSend);
            }}
          >
            {isSending && (
              <Loader2Icon
                size={14}
                className="mr-2 animate-spin"
                aria-hidden="true"
              />
            )}
            {t('sendCount', { count: sendCount })}
          </AlertDialogAction>
          <AlertDialogCancel variant="ghost" className="w-full">
            {t('cancel')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

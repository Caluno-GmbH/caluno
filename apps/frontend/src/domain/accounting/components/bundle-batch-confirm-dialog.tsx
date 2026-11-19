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
} from '@repo/ui';
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { BundleGroup } from '../lib/mass-actions';

interface BundleBatchConfirmDialogProps {
  open: boolean;
  sendable: {
    group: BundleGroup;
    recipientEmail: string;
    issues: BundleDeliveryIssue[];
  }[];
  needsAttention: {
    group: BundleGroup;
    reason: 'no-recipient' | 'too-large';
  }[];
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const PAUSCHALE_TYPE_KEY = {
  ehrenamt: 'toolbar.typeEP',
  uebungsleiter: 'toolbar.typeUL',
} as const;

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

  const canSend = sendable.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        {sendable.length > 0 && (
          <ul className="space-y-3">
            {sendable.map(({ group, recipientEmail, issues }) => (
              <li
                key={`${group.volunteerId}::${group.pauschale}`}
                className="space-y-1"
              >
                <p className="text-sm">
                  {t('bundleLine', {
                    name: group.volunteerName,
                    type: tBoard(PAUSCHALE_TYPE_KEY[group.pauschale]),
                    email: recipientEmail,
                  })}
                </p>
                {issues.length > 0 && (
                  <ul className="space-y-1 pl-2">
                    <li className="text-xs text-muted-foreground">
                      {t('issuesLabel')}
                    </li>
                    {issues.map((issue) => (
                      <li
                        key={issue}
                        className="flex items-start gap-2 text-sm"
                      >
                        <TriangleAlertIcon
                          size={16}
                          className="mt-0.5 shrink-0 text-alert"
                          aria-hidden="true"
                        />
                        <span>{tBundle(`confirmDialog.issues.${issue}`)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {needsAttention.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('needsAttentionLabel')}</p>
            <ul className="space-y-1">
              {needsAttention.map(({ group, reason }) => (
                <li
                  key={`${group.volunteerId}::${group.pauschale}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <TriangleAlertIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    {group.volunteerName}
                    {' · '}
                    {tBoard(PAUSCHALE_TYPE_KEY[group.pauschale])}
                    {' — '}
                    {reason === 'no-recipient'
                      ? tBundle('noRecipient')
                      : tBundle('sendTooLarge')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-col sm:items-stretch">
          {canSend && (
            <AlertDialogAction
              className="w-full"
              disabled={isSending}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {isSending && (
                <Loader2Icon
                  size={14}
                  className="mr-2 animate-spin"
                  aria-hidden="true"
                />
              )}
              {t('send')}
            </AlertDialogAction>
          )}
          <AlertDialogCancel variant="ghost" className="w-full">
            {t('cancel')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

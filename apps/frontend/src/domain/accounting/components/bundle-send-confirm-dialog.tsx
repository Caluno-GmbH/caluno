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
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BundleSendConfirmDialogProps {
  open: boolean;
  volunteerName: string;
  recipientEmail: string;
  issues: BundleDeliveryIssue[];
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function BundleSendConfirmDialog({
  open,
  volunteerName,
  recipientEmail,
  issues,
  isSending,
  onOpenChange,
  onConfirm,
}: BundleSendConfirmDialogProps) {
  const t = useTranslations('Accounting.reimbursements.bundle.confirmDialog');
  const tCommon = useTranslations('Common');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description', { volunteer: volunteerName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={issue} className="flex items-start gap-2 text-sm">
              <TriangleAlertIcon
                size={16}
                className="mt-0.5 shrink-0 text-alert"
                aria-hidden="true"
              />
              <span>{t(`issues.${issue}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground break-words">
          {t('recipient', { recipient: recipientEmail })}
        </p>

        <AlertDialogFooter className="flex-col sm:flex-col sm:items-stretch">
          <AlertDialogAction
            className="w-full"
            disabled={isSending}
            onClick={(e) => {
              // Stays open until the send settles; the caller closes it.
              e.preventDefault();
              onConfirm();
            }}
          >
            {t('confirm')}
          </AlertDialogAction>
          <AlertDialogCancel variant="ghost" className="w-full">
            {tCommon('cancel')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

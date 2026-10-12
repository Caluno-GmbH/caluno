'use client';

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
import { useTranslations } from 'next-intl';

type UnverifiedCheckInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean | undefined;
};

export function UnverifiedCheckInDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: UnverifiedCheckInDialogProps) {
  const t = useTranslations('CheckIn');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('unverifiedCheckInConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('unverifiedCheckInConfirmBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {t('unverifiedCheckInConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

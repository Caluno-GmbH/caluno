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

type AddToShiftOverCapacityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteerName: string;
  onConfirm: () => void;
  isPending?: boolean | undefined;
};

/**
 * Confirms adding a volunteer to an assignment that has no free seat left;
 * confirming adds them over capacity.
 */
export function AddToShiftOverCapacityDialog({
  open,
  onOpenChange,
  volunteerName,
  onConfirm,
  isPending,
}: AddToShiftOverCapacityDialogProps) {
  const t = useTranslations('CheckIn');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('shiftFullTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('shiftFullDescription', { name: volunteerName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {t('shiftFullConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

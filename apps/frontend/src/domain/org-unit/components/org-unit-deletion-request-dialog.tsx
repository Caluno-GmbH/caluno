'use client';

import type { OrgUnitTreeNode } from '@repo/data';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldError,
  FieldLabel,
  Textarea,
} from '@repo/ui';
import { Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { requestOrgUnitDeletion } from '@/domain/org-unit/actions';

interface OrgUnitDeletionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationUnitId: string;
  unit: OrgUnitTreeNode | null;
}

export function OrgUnitDeletionRequestDialog({
  open,
  onOpenChange,
  organizationUnitId,
  unit,
}: OrgUnitDeletionRequestDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const t = useTranslations('OrgUnit.delete');
  const tCommon = useTranslations('Common');

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage('');
      setServerError(null);
      setSent(false);
    }
    onOpenChange(nextOpen);
  };

  const handleRequest = () => {
    if (!unit) return;
    setServerError(null);

    startTransition(async () => {
      const result = await requestOrgUnitDeletion({
        id: unit.id,
        organizationUnitId,
        message: message.trim() || undefined,
      });
      if (result?.serverError) {
        setServerError(result.serverError);
      } else {
        setSent(true);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {sent ? t('sentTitle') : t('title', { name: unit?.name ?? '' })}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {sent
              ? t('sentDescription', { name: unit?.name ?? '' })
              : t('description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!sent && (
          <Field>
            <FieldLabel htmlFor="deletion-request-message">
              {t('messageLabel')}
            </FieldLabel>

            <Textarea
              id="deletion-request-message"
              className="min-h-32"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isPending}
              rows={4}
            />
          </Field>
        )}

        {serverError && <FieldError>{serverError}</FieldError>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <X />
            {sent ? tCommon('done') : tCommon('cancel')}
          </AlertDialogCancel>

          {!sent && (
            <Button onClick={handleRequest} disabled={isPending}>
              <Send />
              {isPending ? t('requesting') : t('requestButton')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

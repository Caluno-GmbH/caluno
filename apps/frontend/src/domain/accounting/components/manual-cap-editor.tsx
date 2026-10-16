'use client';

import { Button, Input } from '@repo/ui';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatEuro } from '@/lib/formatting/formats';
import {
  initialCapAmountEuros,
  parseEuroInputToCents,
  projectedCapAmount,
} from '../lib/manual-cap';
import { InfoPanel } from './info-panel';

interface ManualCapEditorProps {
  /** The saved initial amount for the year, as stored on the server. */
  initialAmountCents: number | null | undefined;
  /** The coordinator's unsaved edit, or null while untouched. */
  pendingAmountCents: number | null;
  /** Called when the coordinator confirms an amount; it is saved with the timesheet, not immediately. */
  onCommitAmount: (amountCents: number) => void;
  usedBefore: number;
  selectedAmount: number;
  className?: string;
}

/**
 * Edits the volunteer's initial yearly amount. The confirmed value is held as a
 * draft by the owning dialog and persisted together with the timesheet, so
 * cancelling the timesheet creation discards it (VOLI-1569).
 */
export function ManualCapEditor({
  initialAmountCents,
  pendingAmountCents,
  onCommitAmount,
  usedBefore,
  selectedAmount,
  className,
}: ManualCapEditorProps) {
  const t = useTranslations('Accounting.reimbursements.invoiceModal.manualCap');

  const displayedCents = pendingAmountCents ?? initialAmountCents ?? 0;
  const displayedEuros = initialCapAmountEuros(displayedCents);
  const projected = projectedCapAmount(usedBefore, selectedAmount);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleEdit = () => {
    setDraft(displayedEuros === 0 ? '' : String(displayedEuros));
    setIsEditing(true);
  };

  const handleSave = () => {
    const amountCents = parseEuroInputToCents(draft);
    if (amountCents === null) return;
    onCommitAmount(amountCents);
    setIsEditing(false);
    toast.success(t('deferredToast'));
  };

  return (
    <InfoPanel
      title={t('title')}
      className={className}
      headerRight={
        isEditing ? undefined : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleEdit}
          >
            <PencilIcon />
            <span className="sr-only">{t('editButtonLabel')}</span>
          </Button>
        )
      }
    >
      {isEditing ? (
        <div className="mt-2 flex items-center gap-1">
          <Input
            aria-label={t('inputLabel')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
          <Button
            type="button"
            variant="outline"
            size="icon-md"
            onClick={handleSave}
            disabled={parseEuroInputToCents(draft) === null}
          >
            <CheckIcon />
            <span className="sr-only">{t('saveButtonLabel')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            onClick={() => setIsEditing(false)}
          >
            <XIcon />
            <span className="sr-only">{t('cancelButtonLabel')}</span>
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-base">{formatEuro(displayedEuros)}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {t('projectedAfter', { after: formatEuro(projected) })}
      </p>
    </InfoPanel>
  );
}

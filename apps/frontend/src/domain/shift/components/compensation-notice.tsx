'use client';

import type { ReimbursementTypeKey } from '@repo/data';
import { Badge, cn } from '@repo/ui';
import { Coins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { compensationLabelFor } from '../compensation-display';

interface CompensationNoticeProps {
  /** The shift occurrence's effective reimbursement type key, or null/absent
   * for an unpaid shift. Unpaid shifts render nothing — there is no "unpaid"
   * label. */
  reimbursementTypeKey?: ReimbursementTypeKey | null;
  className?: string;
}

/**
 * Volunteer-facing paid indicator: names the Pauschalentyp that compensates
 * the shift and warns that accepting triggers a signed agreement. Renders
 * nothing for unpaid shifts.
 */
export function CompensationNotice({
  reimbursementTypeKey,
  className,
}: CompensationNoticeProps) {
  const t = useTranslations('Shift.compensation');
  const label = compensationLabelFor(reimbursementTypeKey, {
    ehrenamt: t('ehrenamt'),
    uebungsleiter: t('uebungsleiter'),
  });

  if (!label) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Badge variant="secondary" className="w-fit gap-1">
        <Coins className="size-3" aria-hidden="true" />
        {label}
      </Badge>
      <p className="text-[13px] text-muted-foreground">{t('agreementNote')}</p>
    </div>
  );
}

'use client';

import type {
  BundleDeliveryMethod,
  RawAccountingDeliverySettings,
} from '@repo/data';
import { Button, Separator } from '@repo/ui';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { isEmailMethod } from '../lib/delivery-draft';
import { maskEmail } from '../lib/delivery-settings';
import { useSourceLabel } from './delivery-settings-source';

function useMethodLabel() {
  const t = useTranslations('Accounting.settings.delivery');
  return (method: BundleDeliveryMethod) =>
    isEmailMethod(method) ? t('methodEmail') : t('methodDownload');
}

function SummaryRow({
  label,
  source,
  children,
}: {
  label: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-semibold text-card-foreground">{label}</p>
      <div className="text-right space-y-0.5 min-w-0">
        <div className="text-sm text-card-foreground break-words">
          {children}
        </div>
        <p className="text-sm text-muted-foreground">{source}</p>
      </div>
    </div>
  );
}

/** Read-only rendering for admins without the accounting-manage permission. */
export function DeliverySettingsSummary({
  settings,
}: {
  settings: RawAccountingDeliverySettings;
}) {
  const t = useTranslations('Accounting.settings.delivery');
  const sourceLabel = useSourceLabel();
  const methodLabel = useMethodLabel();
  const [revealed, setRevealed] = useState(false);
  const recipient = settings.recipientEmail;

  return (
    <div className="space-y-4">
      <SummaryRow
        label={t('methodLabel')}
        source={sourceLabel(settings.deliveryMethodSource)}
      >
        {methodLabel(settings.deliveryMethod)}
      </SummaryRow>
      <Separator />
      <SummaryRow
        label={t('recipientLabel')}
        source={sourceLabel(settings.recipientEmailSource)}
      >
        {recipient ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tabular-nums">
              {revealed ? recipient : maskEmail(recipient)}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={revealed ? t('hideRecipient') : t('showRecipient')}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </Button>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('recipientNotSet')}</span>
        )}
      </SummaryRow>
      <Separator />
      <SummaryRow
        label={t('subjectLabel')}
        source={sourceLabel(settings.emailSubjectSource)}
      >
        {settings.emailSubject}
      </SummaryRow>
    </div>
  );
}

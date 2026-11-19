'use client';

import { Button, cn } from '@repo/ui';
import { Loader2Icon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MassActionBarProps {
  selectedCount: number;
  contractCount: number;
  timesheetCount: number;
  bundleCount: number;
  bundleMode: 'send' | 'download';
  busyAction: 'contracts' | 'timesheets' | 'bundles' | null;
  onCountersignContracts: () => void;
  onCountersignTimesheets: () => void;
  onSendBundles: () => void;
  onDeselectAll: () => void;
}

export function MassActionBar({
  selectedCount,
  contractCount,
  timesheetCount,
  bundleCount,
  bundleMode,
  busyAction,
  onCountersignContracts,
  onCountersignTimesheets,
  onSendBundles,
  onDeselectAll,
}: MassActionBarProps) {
  const t = useTranslations('Accounting.reimbursements.massActions');

  if (selectedCount < 2) return null;

  const isDisabled = busyAction !== null;

  type CtaDef = {
    key: 'contracts' | 'timesheets' | 'bundles';
    label: string;
    onClick: () => void;
  };

  const visibleCtas: CtaDef[] = (
    [
      contractCount > 0 && {
        key: 'contracts' as const,
        label: t('countersignContracts', { count: contractCount }),
        onClick: onCountersignContracts,
      },
      timesheetCount > 0 && {
        key: 'timesheets' as const,
        label: t('countersignTimesheets', { count: timesheetCount }),
        onClick: onCountersignTimesheets,
      },
      bundleCount > 0 && {
        key: 'bundles' as const,
        label:
          bundleMode === 'send'
            ? t('sendBundles', { count: bundleCount })
            : t('downloadBundles', { count: bundleCount }),
        onClick: onSendBundles,
      },
    ] as (CtaDef | false)[]
  ).filter((x): x is CtaDef => Boolean(x));

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {t('selectedCount', { count: selectedCount })}
        </span>

        {visibleCtas.length === 0 ? (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {t('noActions')}
          </span>
        ) : (
          visibleCtas.map((cta, index) => {
            const isLast = index === visibleCtas.length - 1;
            const isBusy = busyAction === cta.key;

            return (
              <Button
                key={cta.key}
                variant={isLast ? 'default' : 'outline'}
                size="sm"
                disabled={isDisabled}
                onClick={cta.onClick}
                className={cn('gap-1.5', isBusy && 'opacity-80')}
              >
                {isBusy && <Loader2Icon size={14} className="animate-spin" />}
                {cta.label}
              </Button>
            );
          })
        )}

        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          onClick={onDeselectAll}
          className="gap-1.5 text-muted-foreground"
        >
          <XIcon size={14} aria-hidden="true" />
          {t('deselectAll')}
        </Button>
      </div>
    </div>
  );
}

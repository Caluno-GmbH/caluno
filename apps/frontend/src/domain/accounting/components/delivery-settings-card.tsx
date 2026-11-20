'use client';

import { useAccountingDeliverySettings } from '@repo/data/react';
import { AlertCircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DeliverySettingsForm } from './delivery-settings-form';
import { DeliverySettingsSkeleton } from './delivery-settings-skeleton';
import { DeliverySettingsSummary } from './delivery-settings-summary';

interface DeliverySettingsCardProps {
  canEdit: boolean;
  organizationUnitId: string;
}

export function DeliverySettingsCard({
  canEdit,
  organizationUnitId,
}: DeliverySettingsCardProps) {
  const t = useTranslations('Accounting.settings.delivery');
  const query = useAccountingDeliverySettings(organizationUnitId);

  if (query.isLoading) return <DeliverySettingsSkeleton />;
  if (query.isError || !query.data) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <AlertCircleIcon
          size={16}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p>{t('loadError')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('sectionTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('sectionSubtitle')}
        </p>
      </div>
      {canEdit ? (
        <DeliverySettingsForm
          settings={query.data}
          organizationUnitId={organizationUnitId}
        />
      ) : (
        <DeliverySettingsSummary settings={query.data} />
      )}
    </div>
  );
}

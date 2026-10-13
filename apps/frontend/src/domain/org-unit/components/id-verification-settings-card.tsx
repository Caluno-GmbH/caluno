'use client';

import { Card, CardContent, Switch } from '@repo/ui';
import { IdCard } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface IdVerificationSettingsCardProps {
  enabled: boolean;
  canEdit: boolean;
  isSaving?: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function IdVerificationSettingsCard({
  enabled,
  canEdit,
  isSaving = false,
  onEnabledChange,
}: IdVerificationSettingsCardProps) {
  const t = useTranslations('IdVerification');

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex flex-1 gap-2">
          <IdCard className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p id="id-verification-label" className="font-medium">
              {t('card.label')}
            </p>
            <p
              id="id-verification-description"
              className="text-sm text-muted-foreground"
            >
              {t('card.description')}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={!canEdit || isSaving}
          aria-labelledby="id-verification-label"
          aria-describedby="id-verification-description"
          onCheckedChange={(next) => {
            if (!canEdit || isSaving) return;
            onEnabledChange(next);
          }}
        />
      </CardContent>
    </Card>
  );
}

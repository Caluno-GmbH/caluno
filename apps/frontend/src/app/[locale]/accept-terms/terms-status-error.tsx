'use client';

import { Button } from '@repo/ui';
import { useTranslations } from 'next-intl';

export function TermsStatusError() {
  const t = useTranslations('Terms');
  const tError = useTranslations('Error');

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-md text-muted-foreground text-sm">
        {t('loadFailed')}
      </p>
      <Button onClick={() => window.location.reload()}>
        {tError('reloadPage')}
      </Button>
    </div>
  );
}

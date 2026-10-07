'use client';

import { Card, CardContent } from '@repo/ui';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Informational note shown while "Check in without shift" is active.
 *
 * It says the one thing the coordinator has to act on: hours recorded this way
 * carry no compensation type, so one has to be added by hand if the volunteer
 * is to be paid for them. It used to list four consequences, which user testing
 * found harder to act on than the single instruction. Never blocks the
 * check-in button.
 */
export function CheckInWithoutShiftWarningCard() {
  const t = useTranslations('CheckIn');

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Info className="size-5" />
          </div>
          <p className="font-semibold">{t('shiftlessWarningTitle')}</p>
        </div>
        <p className="pl-10 text-sm text-muted-foreground">
          {t('shiftlessWarningBody')}
        </p>
      </CardContent>
    </Card>
  );
}

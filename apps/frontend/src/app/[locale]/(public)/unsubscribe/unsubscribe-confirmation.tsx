'use client';

import { useUnsubscribeFromEmails } from '@repo/data/react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { useTranslations } from 'next-intl';

export function UnsubscribeConfirmation() {
  const t = useTranslations('Unsubscribe');
  const unsubscribe = useUnsubscribeFromEmails();

  if (unsubscribe.isSuccess) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>{t('successTitle')}</CardTitle>
          <CardDescription>{t('success')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          onClick={() => unsubscribe.mutate()}
          disabled={unsubscribe.isPending}
        >
          {unsubscribe.isPending ? t('confirming') : t('confirm')}
        </Button>
        {unsubscribe.isError && (
          <p className="text-destructive text-sm">{t('error')}</p>
        )}
      </CardContent>
    </Card>
  );
}

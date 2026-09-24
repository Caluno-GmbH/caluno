'use client';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui';
import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const EmptyVolunteerMatches = () => {
  const t = useTranslations('Volunteer');

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{t('search.emptyTitle')}</EmptyTitle>
        <EmptyDescription>{t('search.emptyDescription')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

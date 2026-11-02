'use client';

import { useTranslations } from 'next-intl';
import { NoteEditor } from './note-editor';

export function AdminMyNotePage() {
  const t = useTranslations('EeNote');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t('adminTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('adminDescription')}</p>
      <NoteEditor showHeading={false} />
    </div>
  );
}

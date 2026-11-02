'use client';

import { useTranslations } from 'next-intl';
import { NoteEditor } from './note-editor';

/** EE: note editor at the end of the volunteering profile. */
export function ProfileNoteSection() {
  const t = useTranslations('EeNote');

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <NoteEditor showHeading={false} />
    </section>
  );
}

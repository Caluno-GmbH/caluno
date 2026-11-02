import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { hasEeEdition } from '@/edition/has-ee-edition';
import { resolveLocale } from '@/i18n/routing';

type MyNotePageProps = {
  params: Promise<{ locale: string; orgUId: string }>;
};

export default async function MyNotePage({ params }: MyNotePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  if (!hasEeEdition()) {
    notFound();
  }

  const { AdminMyNotePage } = await import(
    /* webpackIgnore: true */ '@/ee/note/admin-my-note-page'
  );
  return <AdminMyNotePage />;
}

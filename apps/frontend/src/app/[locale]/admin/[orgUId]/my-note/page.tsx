import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { resolveEeSlotComponent } from '@/edition/ee-slot';
import { resolveLocale } from '@/i18n/routing';

type MyNotePageProps = {
  params: Promise<{ locale: string; orgUId: string }>;
};

export default async function MyNotePage({ params }: MyNotePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);

  const AdminMyNotePage = await resolveEeSlotComponent('my-note-page');
  if (!AdminMyNotePage) {
    notFound();
  }
  return <AdminMyNotePage />;
}

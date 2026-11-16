import { getTranslations } from 'next-intl/server';

/**
 * Catches unknown URLs (via `[...rest]`) and every `notFound()` outside
 * `/admin/[orgUId]`, which has its own `not-found.tsx`.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('Error.pageNotFound');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p>{t('description')}</p>
      </div>
    </div>
  );
}

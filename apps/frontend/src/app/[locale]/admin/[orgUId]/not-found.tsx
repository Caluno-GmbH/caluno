import { getTranslations } from 'next-intl/server';

/**
 * Catches every `notFound()` under `/admin/[orgUId]` — missing resources,
 * invalid UUID segments, and EE-only page stubs when the EE tree is absent.
 * Real unknown-org access goes to `/unauthorized` via `requireOrgAccess`, so
 * this boundary must stay a generic page 404 (not "organisation not found").
 */
export default async function AdminSegmentNotFound() {
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

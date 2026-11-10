import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { OverviewBoard } from './components/overview-board';

export default async function TodoPage({
  params,
}: {
  params: Promise<{ orgUId: string; locale: string }>;
}) {
  const { orgUId, locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  await requireOrgAccess(orgUId);
  const data = await getDataClient({ orgUId, locale });
  const userPermissions = await data.user.getMyPermissions();
  const t = await getTranslations({ locale, namespace: 'Navigation' });

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t('todo')}</h1>
      <OverviewBoard
        orgUId={orgUId}
        permissions={userPermissions.map((permission) => permission.key)}
      />
    </div>
  );
}

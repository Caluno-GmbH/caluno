import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OverviewBoard } from '@/domain/overview/components/overview-board';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';

interface OverviewPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: OverviewPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'Navigation' });
  return { title: `${t('todo')} — Caluno` };
}

export default async function OverviewPage({ params }: OverviewPageProps) {
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

import { getTranslations } from 'next-intl/server';
import { OrgUnitAboutContact } from '@/domain/org-unit/components/org-unit-about-contact';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';

export async function AdminWelcomePage({
  params,
}: {
  params: Promise<{ orgUId: string; locale: string }>;
}) {
  const { orgUId, locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  await requireOrgAccess(orgUId);
  const data = await getDataClient({ orgUId, locale });
  const orgUnit = await requireFound(() =>
    data.organizationUnit.findById(orgUId),
  );
  const t = await getTranslations({ locale, namespace: 'AdminWelcome' });

  return (
    <div className="space-y-6">
      <h1 className="page-title">
        {t('title', { orgUnitName: orgUnit.name })}
      </h1>
      <OrgUnitAboutContact orgUnit={orgUnit} />
    </div>
  );
}

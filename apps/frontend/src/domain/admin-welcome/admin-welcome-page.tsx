import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrgUnitAboutContact } from '@/domain/org-unit/components/org-unit-about-contact';
import type { EditionPageMetaProps } from '@/edition/enterprise-extensions';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';

type AdminWelcomeParams = Promise<{ orgUId: string; locale: string }>;

export async function generateMetadata({
  params,
}: EditionPageMetaProps): Promise<Metadata> {
  const resolved = await params;
  const orgUId = resolved.orgUId ?? '';
  const locale = resolveLocale(resolved.locale ?? '');
  await requireOrgAccess(orgUId);
  const data = await getDataClient({ orgUId, locale });
  const orgUnit = await requireFound(() =>
    data.organizationUnit.findById(orgUId),
  );
  const t = await getTranslations({ locale, namespace: 'AdminWelcome' });
  return {
    title: `${t('title', { orgUnitName: orgUnit.name })} — Caluno`,
  };
}

export async function AdminWelcomePage({
  params,
}: {
  params: AdminWelcomeParams;
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

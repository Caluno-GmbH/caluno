import { PermissionKey } from '@repo/data';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AutomationsSettings } from '@/domain/org-unit/components/automations-settings';
import { IdVerificationSettingsCard } from '@/domain/org-unit/components/id-verification-settings-card';
import { SettingsSection } from '@/domain/org-unit/components/settings-section';
import { getDataClient } from '@/lib/data-client';
import { checkPermission, requirePermission } from '@/lib/permissions-server';

interface ShiftSettingsPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export default async function ShiftSettingsPage({
  params,
}: ShiftSettingsPageProps) {
  const { orgUId, locale } = await params;
  await requirePermission(orgUId, PermissionKey.OrgView);
  const [canEdit = false] = await checkPermission(
    orgUId,
    PermissionKey.OrgEdit,
  );
  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'ShiftSettings' });

  const orgUnit = await data.organizationUnit.findById(orgUId);
  if (!orgUnit) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t('page.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('page.subtitle', { orgName: orgUnit.name })}
        </p>
      </div>

      <AutomationsSettings canEdit={canEdit} />

      <SettingsSection
        title={t('sections.checkIn.title')}
        description={t('sections.checkIn.description')}
      >
        <IdVerificationSettingsCard
          organizationUnitId={orgUId}
          organizationId={orgUnit.organizationId}
          initialEnabled={orgUnit.idVerificationEnabled ?? false}
          canEdit={canEdit}
        />
      </SettingsSection>
    </div>
  );
}

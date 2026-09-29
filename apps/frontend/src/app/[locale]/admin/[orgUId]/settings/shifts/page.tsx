import { OrganizationUnitAutomationKind, PermissionKey } from '@repo/data';
import { Megaphone, UserCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { IdVerificationSettingsCard } from '@/domain/org-unit/components/id-verification-settings-card';
import {
  LeadTimeAutomationCard,
  type LeadTimeAutomationSettings,
} from '@/domain/org-unit/components/lead-time-automation-card';
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

  const [orgUnit, automations] = await Promise.all([
    data.organizationUnit.findById(orgUId),
    data.organizationUnit.findAutomations(orgUId),
  ]);
  if (!orgUnit) notFound();

  const settingsFor = (
    kind: OrganizationUnitAutomationKind,
  ): LeadTimeAutomationSettings | null => {
    const automation = automations.find((entry) => entry.kind === kind);
    if (!automation) return null;
    return {
      enabled: automation.enabled,
      activeDays: [...automation.activeDays],
      leadTimeHours: automation.leadTimeHours ?? null,
    };
  };

  const urgentCall = settingsFor(OrganizationUnitAutomationKind.UrgentCall);
  const pauseApproval = settingsFor(
    OrganizationUnitAutomationKind.PauseApproval,
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t('page.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('page.subtitle', { orgName: orgUnit.name })}
        </p>
      </div>

      {urgentCall && (
        <SettingsSection
          title={t('sections.staffing.title')}
          description={t('sections.staffing.description')}
        >
          <LeadTimeAutomationCard
            organizationUnitId={orgUId}
            kind={OrganizationUnitAutomationKind.UrgentCall}
            copyKey="callOut"
            icon={<Megaphone />}
            initialSettings={urgentCall}
            canEdit={canEdit}
          />
        </SettingsSection>
      )}

      {pauseApproval && (
        <SettingsSection
          title={t('sections.moderation.title')}
          description={t('sections.moderation.description')}
        >
          <LeadTimeAutomationCard
            organizationUnitId={orgUId}
            kind={OrganizationUnitAutomationKind.PauseApproval}
            copyKey="approval"
            icon={<UserCheck />}
            initialSettings={pauseApproval}
            canEdit={canEdit}
          />
        </SettingsSection>
      )}

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

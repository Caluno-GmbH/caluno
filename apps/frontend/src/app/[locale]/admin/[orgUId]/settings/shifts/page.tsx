import { OrganizationUnitAutomationKind, PermissionKey } from '@repo/data';
import { Mail, Megaphone, UserCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  AutomationCard,
  type AutomationCardSettings,
} from '@/domain/org-unit/components/automation-card';
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

  const [orgUnit, automations] = await Promise.all([
    data.organizationUnit.findById(orgUId),
    data.organizationUnit.findAutomations(orgUId),
  ]);
  if (!orgUnit) notFound();

  const settingsFor = (
    kind: OrganizationUnitAutomationKind,
  ): AutomationCardSettings | null => {
    const automation = automations.find((entry) => entry.kind === kind);
    if (!automation) return null;
    return {
      enabled: automation.enabled,
      activeDays: [...automation.activeDays],
      leadTimeHours: automation.leadTimeHours ?? null,
      sendAtTime: automation.sendAtTime ?? null,
    };
  };

  const urgentCall = settingsFor(OrganizationUnitAutomationKind.UrgentCall);
  const discoveryEmail = settingsFor(
    OrganizationUnitAutomationKind.DiscoveryEmail,
  );
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

      {(urgentCall || discoveryEmail) && (
        <SettingsSection
          title={t('sections.staffing.title')}
          description={t('sections.staffing.description')}
        >
          {urgentCall && (
            <AutomationCard
              organizationUnitId={orgUId}
              kind={OrganizationUnitAutomationKind.UrgentCall}
              copyKey="callOut"
              icon={<Megaphone />}
              control="leadTime"
              initialSettings={urgentCall}
              canEdit={canEdit}
            />
          )}
          {discoveryEmail && (
            <AutomationCard
              organizationUnitId={orgUId}
              kind={OrganizationUnitAutomationKind.DiscoveryEmail}
              copyKey="discovery"
              icon={<Mail />}
              control="sendTime"
              initialSettings={discoveryEmail}
              canEdit={canEdit}
            />
          )}
        </SettingsSection>
      )}

      {pauseApproval && (
        <SettingsSection
          title={t('sections.moderation.title')}
          description={t('sections.moderation.description')}
        >
          <AutomationCard
            organizationUnitId={orgUId}
            kind={OrganizationUnitAutomationKind.PauseApproval}
            copyKey="approval"
            icon={<UserCheck />}
            control="leadTime"
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

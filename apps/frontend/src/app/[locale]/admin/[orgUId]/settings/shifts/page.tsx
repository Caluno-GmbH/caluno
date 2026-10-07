import { OrganizationUnitAutomationKind, PermissionKey } from '@repo/data';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShiftSettingsEditor } from '@/domain/org-unit/components/shift-settings-editor';
import type {
  AutomationControl,
  AutomationDraft,
  ShiftSettingsDraft,
} from '@/domain/org-unit/shift-settings-draft';
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

  const draftFor = (
    kind: OrganizationUnitAutomationKind,
    control: AutomationControl,
  ): AutomationDraft | null => {
    const automation = automations.find((entry) => entry.kind === kind);
    if (!automation) return null;
    return {
      kind,
      control,
      enabled: automation.enabled,
      activeDays: [...automation.activeDays],
      leadTimeHours: automation.leadTimeHours ?? null,
      sendAtTime: automation.sendAtTime ?? null,
    };
  };

  const initialAutomations = [
    draftFor(OrganizationUnitAutomationKind.UrgentCall, 'leadTime'),
    draftFor(OrganizationUnitAutomationKind.DiscoveryEmail, 'sendTime'),
    draftFor(OrganizationUnitAutomationKind.PauseApproval, 'leadTime'),
  ].filter((automation): automation is AutomationDraft => automation !== null);

  const initialDraft: ShiftSettingsDraft = {
    automations: initialAutomations,
    idVerificationEnabled: orgUnit.idVerificationEnabled ?? false,
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t('page.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('page.subtitle', { orgName: orgUnit.name })}
        </p>
      </div>

      <ShiftSettingsEditor
        organizationUnitId={orgUId}
        organizationId={orgUnit.organizationId}
        canEdit={canEdit}
        initialDraft={initialDraft}
      />
    </div>
  );
}

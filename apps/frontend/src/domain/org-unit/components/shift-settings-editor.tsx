'use client';

import {
  OrganizationUnitAutomationKind,
  useUpdateOrganizationUnit,
  useUpdateOrganizationUnitAutomation,
} from '@repo/data/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui';
import { Mail, Megaphone, UserCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageActions } from '@/components/page-actions';
import {
  type GuardedNavigation,
  stripKnownLocalePrefix,
  useUnsavedChangesGuard,
} from '@/hooks/use-unsaved-changes-guard';
import { useRouter } from '@/i18n/navigation';
import {
  type AutomationDraft,
  automationsTurningOn,
  cloneShiftSettingsDraft,
  isShiftSettingsDirty,
  markAutomationSaved,
  markIdVerificationSaved,
  planShiftSettingsSave,
  type ShiftSettingsDraft,
  withAutomationPatch,
  withIdVerificationEnabled,
} from '../shift-settings-draft';
import { AutomationCard, type AutomationCardSettings } from './automation-card';
import { IdVerificationSettingsCard } from './id-verification-settings-card';
import { SettingsSection } from './settings-section';

interface ShiftSettingsEditorProps {
  organizationUnitId: string;
  organizationId: string;
  canEdit: boolean;
  initialDraft: ShiftSettingsDraft;
}

const PRESENTATION = {
  [OrganizationUnitAutomationKind.UrgentCall]: {
    copyKey: 'callOut',
    icon: <Megaphone />,
  },
  [OrganizationUnitAutomationKind.DiscoveryEmail]: {
    copyKey: 'discovery',
    icon: <Mail />,
  },
  [OrganizationUnitAutomationKind.PauseApproval]: {
    copyKey: 'approval',
    icon: <UserCheck />,
  },
} as const;

function cardSettings(automation: AutomationDraft): AutomationCardSettings {
  return {
    enabled: automation.enabled,
    activeDays: [...automation.activeDays],
    leadTimeHours: automation.leadTimeHours,
    sendAtTime: automation.sendAtTime,
  };
}

export function ShiftSettingsEditor({
  organizationUnitId,
  organizationId,
  canEdit,
  initialDraft,
}: ShiftSettingsEditorProps) {
  const t = useTranslations('ShiftSettings');
  const tAutomations = useTranslations('Automations');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const updateAutomation = useUpdateOrganizationUnitAutomation();
  const updateUnit = useUpdateOrganizationUnit();
  const [saved, setSaved] = useState(() =>
    cloneShiftSettingsDraft(initialDraft),
  );
  const [draft, setDraft] = useState(() =>
    cloneShiftSettingsDraft(initialDraft),
  );
  const [saving, setSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<GuardedNavigation | null>(null);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const savingRef = useRef(false);

  const dirty = canEdit && isShiftSettingsDirty(saved, draft);
  const turningOn = automationsTurningOn(saved, draft);
  const turningOnNames = new Intl.ListFormat(locale, {
    type: 'conjunction',
  }).format(
    turningOn.map((kind) => {
      const presentation = PRESENTATION[kind];
      return presentation
        ? tAutomations(`${presentation.copyKey}.title`)
        : kind;
    }),
  );
  const { release: releaseNavigationGuard } = useUnsavedChangesGuard({
    enabled: dirty,
    onPrompt: setPendingNavigation,
  });

  const automationFor = (kind: OrganizationUnitAutomationKind) =>
    draft.automations.find((automation) => automation.kind === kind);

  const patchAutomation = (
    kind: OrganizationUnitAutomationKind,
    patch: Partial<AutomationCardSettings>,
  ) => {
    setDraft((current) => withAutomationPatch(current, kind, patch));
  };

  function handleCancel() {
    setDraft(cloneShiftSettingsDraft(saved));
    setConfirmingSave(false);
  }

  function handleSaveClick() {
    if (savingRef.current) return;
    if (turningOn.length > 0) {
      setConfirmingSave(true);
      return;
    }
    void persist();
  }

  async function persist() {
    if (savingRef.current) return;
    const plan = planShiftSettingsSave(saved, draft);
    if (plan.automations.length === 0 && plan.idVerificationEnabled === null) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setConfirmingSave(false);
    let baseline = saved;
    let savedAny = false;
    try {
      for (const automation of plan.automations) {
        await updateAutomation.mutateAsync({
          organizationUnitId,
          kind: automation.kind,
          input: automation.input,
        });
        baseline = markAutomationSaved(baseline, draft, automation.kind);
        setSaved(baseline);
        savedAny = true;
      }

      if (plan.idVerificationEnabled !== null) {
        const enabled = plan.idVerificationEnabled;
        await updateUnit.mutateAsync({
          id: organizationUnitId,
          input: { organizationId, idVerificationEnabled: enabled },
        });
        baseline = markIdVerificationSaved(baseline, enabled);
        setSaved(baseline);
        savedAny = true;
      }

      setDraft(cloneShiftSettingsDraft(baseline));
      toast.success(t('actions.saved'));
      router.refresh();
    } catch {
      toast.error(
        savedAny ? t('actions.savePartialError') : t('actions.saveError'),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleLeave() {
    const target = pendingNavigation;
    setPendingNavigation(null);
    if (!target) return;
    releaseNavigationGuard();
    if (target.type === 'back') {
      if (target.delta === null) {
        router.push(`/admin/${organizationUnitId}`);
        return;
      }
      window.history.go(target.delta);
      return;
    }
    router.push(stripKnownLocalePrefix(target.href));
  }

  const urgentCall = automationFor(OrganizationUnitAutomationKind.UrgentCall);
  const discoveryEmail = automationFor(
    OrganizationUnitAutomationKind.DiscoveryEmail,
  );
  const pauseApproval = automationFor(
    OrganizationUnitAutomationKind.PauseApproval,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageActions
        scrollLabel={t('page.title')}
        showActions={canEdit}
        saveLabel={saving ? tCommon('saving') : tCommon('save')}
        onSave={handleSaveClick}
        saveDisabled={!dirty || saving}
        cancel={{
          label: tCommon('cancel'),
          onClick: handleCancel,
          disabled: !dirty || saving,
        }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {(urgentCall || discoveryEmail) && (
            <SettingsSection
              title={t('sections.staffing.title')}
              description={t('sections.staffing.description')}
            >
              {urgentCall && (
                <AutomationCard
                  copyKey={
                    PRESENTATION[OrganizationUnitAutomationKind.UrgentCall]
                      .copyKey
                  }
                  icon={
                    PRESENTATION[OrganizationUnitAutomationKind.UrgentCall].icon
                  }
                  control={urgentCall.control}
                  settings={cardSettings(urgentCall)}
                  canEdit={canEdit}
                  isSaving={saving}
                  onChange={(patch) => patchAutomation(urgentCall.kind, patch)}
                />
              )}
              {discoveryEmail && (
                <AutomationCard
                  copyKey={
                    PRESENTATION[OrganizationUnitAutomationKind.DiscoveryEmail]
                      .copyKey
                  }
                  icon={
                    PRESENTATION[OrganizationUnitAutomationKind.DiscoveryEmail]
                      .icon
                  }
                  control={discoveryEmail.control}
                  settings={cardSettings(discoveryEmail)}
                  canEdit={canEdit}
                  isSaving={saving}
                  onChange={(patch) =>
                    patchAutomation(discoveryEmail.kind, patch)
                  }
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
                copyKey={
                  PRESENTATION[OrganizationUnitAutomationKind.PauseApproval]
                    .copyKey
                }
                icon={
                  PRESENTATION[OrganizationUnitAutomationKind.PauseApproval]
                    .icon
                }
                control={pauseApproval.control}
                settings={cardSettings(pauseApproval)}
                canEdit={canEdit}
                isSaving={saving}
                onChange={(patch) => patchAutomation(pauseApproval.kind, patch)}
              />
            </SettingsSection>
          )}

          <SettingsSection
            title={t('sections.checkIn.title')}
            description={t('sections.checkIn.description')}
          >
            <IdVerificationSettingsCard
              enabled={draft.idVerificationEnabled}
              canEdit={canEdit}
              isSaving={saving}
              onEnabledChange={(enabled) =>
                setDraft((current) =>
                  withIdVerificationEnabled(current, enabled),
                )
              }
            />
          </SettingsSection>
        </div>
      </PageActions>

      <AlertDialog
        open={confirmingSave}
        onOpenChange={(open) => {
          if (!open) setConfirmingSave(false);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('actions.confirmEnableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.confirmEnableDescription', {
                names: turningOnNames,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void persist()}>
              {t('actions.confirmEnableAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('actions.unsavedChangesTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.unsavedChangesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('actions.unsavedChangesStay')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} variant="destructive">
              {t('actions.unsavedChangesLeave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

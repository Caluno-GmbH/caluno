export type AutomationControl = 'leadTime' | 'sendTime';

export interface AutomationDraft {
  kind: string;
  control: AutomationControl;
  enabled: boolean;
  activeDays: readonly string[];
  leadTimeHours: number | null;
  sendAtTime: string | null;
}

export interface ShiftSettingsDraft {
  automations: readonly AutomationDraft[];
  idVerificationEnabled: boolean;
}

export interface AutomationSaveInput {
  enabled: boolean;
  activeDays: string[];
  leadTimeHours?: number;
  sendAtTime?: string;
}

export interface AutomationSave {
  kind: string;
  input: AutomationSaveInput;
}

export interface ShiftSettingsSavePlan {
  automations: AutomationSave[];
  idVerificationEnabled: boolean | null;
}

function cloneAutomation(automation: AutomationDraft): AutomationDraft {
  return { ...automation, activeDays: [...automation.activeDays] };
}

export function cloneShiftSettingsDraft(
  draft: ShiftSettingsDraft,
): ShiftSettingsDraft {
  return {
    idVerificationEnabled: draft.idVerificationEnabled,
    automations: draft.automations.map(cloneAutomation),
  };
}

function sameDays(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightDays = new Set(right);
  return left.every((day) => rightDays.has(day));
}

function automationsEqual(
  left: AutomationDraft,
  right: AutomationDraft,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.leadTimeHours === right.leadTimeHours &&
    left.sendAtTime === right.sendAtTime &&
    sameDays(left.activeDays, right.activeDays)
  );
}

function saveInput(automation: AutomationDraft): AutomationSaveInput {
  const input: AutomationSaveInput = {
    enabled: automation.enabled,
    activeDays: [...automation.activeDays],
  };
  if (automation.control === 'leadTime' && automation.leadTimeHours != null) {
    input.leadTimeHours = automation.leadTimeHours;
  }
  if (automation.control === 'sendTime' && automation.sendAtTime != null) {
    input.sendAtTime = automation.sendAtTime;
  }
  return input;
}

export function planShiftSettingsSave(
  saved: ShiftSettingsDraft,
  draft: ShiftSettingsDraft,
): ShiftSettingsSavePlan {
  const savedByKind = new Map(
    saved.automations.map((automation) => [automation.kind, automation]),
  );
  const automations = draft.automations.flatMap((automation) => {
    const previous = savedByKind.get(automation.kind);
    if (previous && automationsEqual(previous, automation)) return [];
    return [{ kind: automation.kind, input: saveInput(automation) }];
  });

  return {
    automations,
    idVerificationEnabled:
      saved.idVerificationEnabled === draft.idVerificationEnabled
        ? null
        : draft.idVerificationEnabled,
  };
}

export function isShiftSettingsDirty(
  saved: ShiftSettingsDraft,
  draft: ShiftSettingsDraft,
): boolean {
  const plan = planShiftSettingsSave(saved, draft);
  return plan.automations.length > 0 || plan.idVerificationEnabled !== null;
}

export function automationsTurningOn(
  saved: ShiftSettingsDraft,
  draft: ShiftSettingsDraft,
): string[] {
  const savedByKind = new Map(
    saved.automations.map((automation) => [automation.kind, automation]),
  );
  return draft.automations.flatMap((automation) => {
    const previous = savedByKind.get(automation.kind);
    const wasEnabled = previous?.enabled ?? false;
    return !wasEnabled && automation.enabled ? [automation.kind] : [];
  });
}

export function withAutomationPatch(
  draft: ShiftSettingsDraft,
  kind: string,
  patch: Partial<
    Pick<
      AutomationDraft,
      'enabled' | 'activeDays' | 'leadTimeHours' | 'sendAtTime'
    >
  >,
): ShiftSettingsDraft {
  return {
    ...draft,
    automations: draft.automations.map((automation) =>
      automation.kind === kind
        ? {
            ...automation,
            ...patch,
            activeDays:
              patch.activeDays !== undefined
                ? [...patch.activeDays]
                : automation.activeDays,
          }
        : automation,
    ),
  };
}

export function withIdVerificationEnabled(
  draft: ShiftSettingsDraft,
  enabled: boolean,
): ShiftSettingsDraft {
  return { ...draft, idVerificationEnabled: enabled };
}

export function markAutomationSaved(
  saved: ShiftSettingsDraft,
  draft: ShiftSettingsDraft,
  kind: string,
): ShiftSettingsDraft {
  const next = draft.automations.find((automation) => automation.kind === kind);
  if (!next) return saved;
  const exists = saved.automations.some(
    (automation) => automation.kind === kind,
  );
  const committed = cloneAutomation(next);
  return {
    ...saved,
    automations: exists
      ? saved.automations.map((automation) =>
          automation.kind === kind ? committed : automation,
        )
      : [...saved.automations, committed],
  };
}

export function markIdVerificationSaved(
  saved: ShiftSettingsDraft,
  enabled: boolean,
): ShiftSettingsDraft {
  return { ...saved, idVerificationEnabled: enabled };
}

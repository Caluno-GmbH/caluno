import { describe, expect, it } from 'bun:test';
import { OrganizationUnitAutomationKind, Weekday } from '@repo/data';
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
} from './shift-settings-draft';

function automation(
  overrides: Partial<AutomationDraft> &
    Pick<AutomationDraft, 'kind' | 'control'>,
): AutomationDraft {
  return {
    enabled: false,
    activeDays: [Weekday.Saturday, Weekday.Sunday],
    leadTimeHours: 48,
    sendAtTime: null,
    ...overrides,
  };
}

function settings(
  overrides: Partial<ShiftSettingsDraft> = {},
): ShiftSettingsDraft {
  return {
    idVerificationEnabled: false,
    automations: [
      automation({
        kind: OrganizationUnitAutomationKind.UrgentCall,
        control: 'leadTime',
      }),
      automation({
        kind: OrganizationUnitAutomationKind.DiscoveryEmail,
        control: 'sendTime',
        activeDays: [Weekday.Sunday],
        leadTimeHours: null,
        sendAtTime: '08:00',
      }),
      automation({
        kind: OrganizationUnitAutomationKind.PauseApproval,
        control: 'leadTime',
      }),
    ],
    ...overrides,
  };
}

describe('planShiftSettingsSave', () => {
  it('plans nothing when the draft matches the last saved settings', () => {
    const saved = settings();
    expect(
      planShiftSettingsSave(saved, cloneShiftSettingsDraft(saved)),
    ).toEqual({
      automations: [],
      idVerificationEnabled: null,
    });
    expect(isShiftSettingsDirty(saved, cloneShiftSettingsDraft(saved))).toBe(
      false,
    );
  });

  it('treats the same active days in a different order as unchanged', () => {
    const saved = settings();
    const draft = withAutomationPatch(
      saved,
      OrganizationUnitAutomationKind.UrgentCall,
      {
        activeDays: [Weekday.Sunday, Weekday.Saturday],
      },
    );
    expect(isShiftSettingsDirty(saved, draft)).toBe(false);
  });

  it('plans only the automations that changed, with the fields that automation uses', () => {
    const saved = settings();
    let draft = withAutomationPatch(
      saved,
      OrganizationUnitAutomationKind.UrgentCall,
      { enabled: true },
    );
    draft = withAutomationPatch(
      draft,
      OrganizationUnitAutomationKind.DiscoveryEmail,
      {
        sendAtTime: '09:15',
      },
    );

    expect(planShiftSettingsSave(saved, draft)).toEqual({
      automations: [
        {
          kind: OrganizationUnitAutomationKind.UrgentCall,
          input: {
            enabled: true,
            activeDays: [Weekday.Saturday, Weekday.Sunday],
            leadTimeHours: 48,
          },
        },
        {
          kind: OrganizationUnitAutomationKind.DiscoveryEmail,
          input: {
            enabled: false,
            activeDays: [Weekday.Sunday],
            sendAtTime: '09:15',
          },
        },
      ],
      idVerificationEnabled: null,
    });
  });

  it('plans an id verification change on its own', () => {
    const saved = settings();
    const draft = withIdVerificationEnabled(saved, true);
    expect(planShiftSettingsSave(saved, draft)).toEqual({
      automations: [],
      idVerificationEnabled: true,
    });
  });

  it('drops a saved automation from the plan without discarding the rest', () => {
    const saved = settings();
    const draft = withAutomationPatch(
      withAutomationPatch(saved, OrganizationUnitAutomationKind.UrgentCall, {
        enabled: true,
      }),
      OrganizationUnitAutomationKind.PauseApproval,
      { leadTimeHours: 24 },
    );
    const afterUrgentCall = markAutomationSaved(
      saved,
      draft,
      OrganizationUnitAutomationKind.UrgentCall,
    );

    expect(planShiftSettingsSave(afterUrgentCall, draft)).toEqual({
      automations: [
        {
          kind: OrganizationUnitAutomationKind.PauseApproval,
          input: {
            enabled: false,
            activeDays: [Weekday.Saturday, Weekday.Sunday],
            leadTimeHours: 24,
          },
        },
      ],
      idVerificationEnabled: null,
    });
  });

  it('keeps an id verification change pending until it is marked saved', () => {
    const saved = settings();
    const draft = withIdVerificationEnabled(saved, true);
    const afterSave = markIdVerificationSaved(saved, true);
    expect(isShiftSettingsDirty(afterSave, draft)).toBe(false);
  });
});

describe('automationsTurningOn', () => {
  it('names an automation only when save would switch it from off to on', () => {
    const saved = settings();
    const enabled = withAutomationPatch(
      saved,
      OrganizationUnitAutomationKind.UrgentCall,
      {
        enabled: true,
      },
    );
    expect(automationsTurningOn(saved, enabled)).toEqual([
      OrganizationUnitAutomationKind.UrgentCall,
    ]);

    const alreadyOn = settings({
      automations: settings().automations.map((automation) =>
        automation.kind === OrganizationUnitAutomationKind.PauseApproval
          ? { ...automation, enabled: true }
          : automation,
      ),
    });
    const retimed = withAutomationPatch(
      alreadyOn,
      OrganizationUnitAutomationKind.PauseApproval,
      {
        leadTimeHours: 12,
      },
    );
    expect(automationsTurningOn(alreadyOn, retimed)).toEqual([]);
  });
});

describe('cloneShiftSettingsDraft', () => {
  it('copies active days so a later edit does not change the saved snapshot', () => {
    const saved = settings();
    const copy = cloneShiftSettingsDraft(saved);
    const copiedDays = copy.automations[0]?.activeDays as Weekday[];
    copiedDays.push(Weekday.Monday);
    expect(saved.automations[0]?.activeDays).toEqual([
      Weekday.Saturday,
      Weekday.Sunday,
    ]);
  });
});

describe('withAutomationPatch', () => {
  it('applies an empty day selection without changing the previous draft', () => {
    const saved = settings();
    const draft = withAutomationPatch(
      saved,
      OrganizationUnitAutomationKind.UrgentCall,
      { activeDays: [] },
    );
    expect(saved.automations[0]?.activeDays).toEqual([
      Weekday.Saturday,
      Weekday.Sunday,
    ]);
    expect(draft.automations[0]?.activeDays).toEqual([]);
    expect(isShiftSettingsDirty(saved, draft)).toBe(true);
  });
});

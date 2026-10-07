import { describe, expect, it } from 'bun:test';
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
    activeDays: ['SATURDAY', 'SUNDAY'],
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
      automation({ kind: 'URGENT_CALL', control: 'leadTime' }),
      automation({
        kind: 'DISCOVERY_EMAIL',
        control: 'sendTime',
        activeDays: ['SUNDAY'],
        leadTimeHours: null,
        sendAtTime: '08:00',
      }),
      automation({ kind: 'PAUSE_APPROVAL', control: 'leadTime' }),
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
    const draft = withAutomationPatch(saved, 'URGENT_CALL', {
      activeDays: ['SUNDAY', 'SATURDAY'],
    });
    expect(isShiftSettingsDirty(saved, draft)).toBe(false);
  });

  it('plans only the automations that changed, with the fields that automation uses', () => {
    const saved = settings();
    let draft = withAutomationPatch(saved, 'URGENT_CALL', { enabled: true });
    draft = withAutomationPatch(draft, 'DISCOVERY_EMAIL', {
      sendAtTime: '09:15',
    });

    expect(planShiftSettingsSave(saved, draft)).toEqual({
      automations: [
        {
          kind: 'URGENT_CALL',
          input: {
            enabled: true,
            activeDays: ['SATURDAY', 'SUNDAY'],
            leadTimeHours: 48,
          },
        },
        {
          kind: 'DISCOVERY_EMAIL',
          input: {
            enabled: false,
            activeDays: ['SUNDAY'],
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
      withAutomationPatch(saved, 'URGENT_CALL', { enabled: true }),
      'PAUSE_APPROVAL',
      { leadTimeHours: 24 },
    );
    const afterUrgentCall = markAutomationSaved(saved, draft, 'URGENT_CALL');

    expect(planShiftSettingsSave(afterUrgentCall, draft)).toEqual({
      automations: [
        {
          kind: 'PAUSE_APPROVAL',
          input: {
            enabled: false,
            activeDays: ['SATURDAY', 'SUNDAY'],
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
    const enabled = withAutomationPatch(saved, 'URGENT_CALL', {
      enabled: true,
    });
    expect(automationsTurningOn(saved, enabled)).toEqual(['URGENT_CALL']);

    const alreadyOn = settings({
      automations: settings().automations.map((automation) =>
        automation.kind === 'PAUSE_APPROVAL'
          ? { ...automation, enabled: true }
          : automation,
      ),
    });
    const retimed = withAutomationPatch(alreadyOn, 'PAUSE_APPROVAL', {
      leadTimeHours: 12,
    });
    expect(automationsTurningOn(alreadyOn, retimed)).toEqual([]);
  });
});

describe('cloneShiftSettingsDraft', () => {
  it('copies active days so a later edit does not change the saved snapshot', () => {
    const saved = settings();
    const copy = cloneShiftSettingsDraft(saved);
    const copiedDays = copy.automations[0]?.activeDays as string[];
    copiedDays.push('MONDAY');
    expect(saved.automations[0]?.activeDays).toEqual(['SATURDAY', 'SUNDAY']);
  });
});

describe('withAutomationPatch', () => {
  it('applies an empty day selection without changing the previous draft', () => {
    const saved = settings();
    const draft = withAutomationPatch(saved, 'URGENT_CALL', { activeDays: [] });
    expect(saved.automations[0]?.activeDays).toEqual(['SATURDAY', 'SUNDAY']);
    expect(draft.automations[0]?.activeDays).toEqual([]);
    expect(isShiftSettingsDirty(saved, draft)).toBe(true);
  });
});

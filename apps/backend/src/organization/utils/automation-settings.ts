import {
  sortWeekdays,
  WEEKEND_WEEKDAYS,
  Weekday,
} from '../../shared/enums/weekday.enum';
import { OrganizationUnitAutomationKind } from '../enums';

export const AUTOMATION_LEAD_TIME_HOURS = [12, 24, 48, 72] as const;
export type AutomationLeadTimeHours =
  (typeof AUTOMATION_LEAD_TIME_HOURS)[number];

export const AUTOMATION_SEND_AT_TIME_PATTERN =
  /^([01]\d|2[0-3]):(00|15|30|45)$/;

export interface AutomationSettings {
  enabled: boolean;
  activeDays: Weekday[];
  leadTimeHours: number | null;
  sendAtTime: string | null;
}

export interface AutomationSpec {
  usesLeadTimeHours: boolean;
  usesSendAtTime: boolean;
  defaults: AutomationSettings;
}

export const AUTOMATION_SPECS: Record<
  OrganizationUnitAutomationKind,
  AutomationSpec
> = {
  [OrganizationUnitAutomationKind.PAUSE_APPROVAL]: {
    usesLeadTimeHours: true,
    usesSendAtTime: false,
    defaults: {
      enabled: false,
      activeDays: [...WEEKEND_WEEKDAYS],
      leadTimeHours: 48,
      sendAtTime: null,
    },
  },
  [OrganizationUnitAutomationKind.URGENT_CALL]: {
    usesLeadTimeHours: true,
    usesSendAtTime: false,
    defaults: {
      enabled: false,
      activeDays: [...WEEKEND_WEEKDAYS],
      leadTimeHours: 48,
      sendAtTime: null,
    },
  },
  [OrganizationUnitAutomationKind.DISCOVERY_EMAIL]: {
    usesLeadTimeHours: false,
    usesSendAtTime: true,
    defaults: {
      enabled: false,
      activeDays: [Weekday.SUNDAY],
      leadTimeHours: null,
      sendAtTime: '08:00',
    },
  },
};

export function defaultAutomationSettings(
  kind: OrganizationUnitAutomationKind,
): AutomationSettings {
  const { defaults } = AUTOMATION_SPECS[kind];
  return { ...defaults, activeDays: [...defaults.activeDays] };
}

export function normalizeSendAtTime(value: string | null): string | null {
  if (value == null) return null;
  const [hours = '', minutes = ''] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function normalizeAutomationSettings(
  kind: OrganizationUnitAutomationKind,
  settings: AutomationSettings,
): AutomationSettings {
  const spec = AUTOMATION_SPECS[kind];
  return {
    enabled: settings.enabled,
    activeDays: sortWeekdays(settings.activeDays),
    leadTimeHours: spec.usesLeadTimeHours ? settings.leadTimeHours : null,
    sendAtTime: spec.usesSendAtTime
      ? normalizeSendAtTime(settings.sendAtTime)
      : null,
  };
}

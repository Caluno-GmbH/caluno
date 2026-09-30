import type { Weekday } from '../../shared/enums/weekday.enum';
import type { OrganizationUnitAutomationKind } from '../enums';
import {
  type AutomationSettings,
  defaultAutomationSettings,
  normalizeAutomationSettings,
} from './automation-settings';

export interface AutomationRow {
  organizationUnitId: string;
  kind: OrganizationUnitAutomationKind;
  enabled: boolean;
  activeDays: Weekday[];
  leadTimeHours: number | null;
  sendAtTime: string | null;
}

export interface ResolvedAutomation extends AutomationSettings {
  kind: OrganizationUnitAutomationKind;
  organizationUnitId: string;
}

export function automationRowKey(
  organizationUnitId: string,
  kind: OrganizationUnitAutomationKind,
): string {
  return `${organizationUnitId}:${kind}`;
}

export function resolveAutomation(
  organizationUnitId: string,
  kind: OrganizationUnitAutomationKind,
  rowsByKey: ReadonlyMap<string, AutomationRow>,
): ResolvedAutomation {
  const row = rowsByKey.get(automationRowKey(organizationUnitId, kind));
  const settings: AutomationSettings = row
    ? {
        enabled: row.enabled,
        activeDays: row.activeDays,
        leadTimeHours: row.leadTimeHours,
        sendAtTime: row.sendAtTime,
      }
    : defaultAutomationSettings(kind);

  return {
    kind,
    organizationUnitId,
    ...normalizeAutomationSettings(kind, settings),
  };
}

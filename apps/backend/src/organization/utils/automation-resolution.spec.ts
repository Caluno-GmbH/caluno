import { describe, expect, it } from 'bun:test';
import { Weekday } from '../../shared/enums/weekday.enum';
import { OrganizationUnitAutomationKind } from '../enums';
import {
  type AutomationRow,
  automationRowKey,
  resolveAutomation,
} from './automation-resolution';

const UNIT = 'unit-1';
const OTHER_UNIT = 'unit-2';

function rowMap(...rows: AutomationRow[]): Map<string, AutomationRow> {
  return new Map(
    rows.map((row) => [
      automationRowKey(row.organizationUnitId, row.kind),
      row,
    ]),
  );
}

function row(overrides: Partial<AutomationRow> = {}): AutomationRow {
  return {
    organizationUnitId: UNIT,
    kind: OrganizationUnitAutomationKind.URGENT_CALL,
    enabled: true,
    activeDays: [Weekday.SATURDAY],
    leadTimeHours: 24,
    sendAtTime: null,
    ...overrides,
  };
}

describe('resolveAutomation', () => {
  it('falls back to the kind defaults when the unit has no row', () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.URGENT_CALL,
      rowMap(),
    );

    expect(resolved.enabled).toBe(false);
    expect(resolved.activeDays).toEqual([Weekday.SATURDAY, Weekday.SUNDAY]);
    expect(resolved.leadTimeHours).toBe(48);
  });

  it('defaults the discovery email to Sunday 08:00, disabled', () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
      rowMap(),
    );

    expect(resolved.enabled).toBe(false);
    expect(resolved.activeDays).toEqual([Weekday.SUNDAY]);
    expect(resolved.sendAtTime).toBe('08:00');
    expect(resolved.leadTimeHours).toBeNull();
  });

  it("uses the unit's own row", () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.URGENT_CALL,
      rowMap(row()),
    );

    expect(resolved.enabled).toBe(true);
    expect(resolved.leadTimeHours).toBe(24);
  });

  it("ignores another unit's row instead of inheriting it", () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.URGENT_CALL,
      rowMap(row({ organizationUnitId: OTHER_UNIT, leadTimeHours: 12 })),
    );

    expect(resolved.enabled).toBe(false);
    expect(resolved.leadTimeHours).toBe(48);
  });

  it('resolves each kind independently', () => {
    const rows = rowMap(
      row({
        kind: OrganizationUnitAutomationKind.PAUSE_APPROVAL,
        leadTimeHours: 72,
      }),
    );

    expect(
      resolveAutomation(
        UNIT,
        OrganizationUnitAutomationKind.PAUSE_APPROVAL,
        rows,
      ).leadTimeHours,
    ).toBe(72);
    expect(
      resolveAutomation(UNIT, OrganizationUnitAutomationKind.URGENT_CALL, rows)
        .enabled,
    ).toBe(false);
  });

  it('keeps a stored row that is switched off', () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.URGENT_CALL,
      rowMap(row({ enabled: false, leadTimeHours: 12 })),
    );

    expect(resolved.enabled).toBe(false);
    expect(resolved.leadTimeHours).toBe(12);
  });

  it('drops fields that do not apply to the kind and orders days by week', () => {
    const resolved = resolveAutomation(
      UNIT,
      OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
      rowMap(
        row({
          kind: OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
          activeDays: [Weekday.SUNDAY, Weekday.TUESDAY],
          leadTimeHours: 48,
          sendAtTime: '8:5',
        }),
      ),
    );

    expect(resolved.activeDays).toEqual([Weekday.TUESDAY, Weekday.SUNDAY]);
    expect(resolved.leadTimeHours).toBeNull();
    expect(resolved.sendAtTime).toBe('08:05');
  });
});

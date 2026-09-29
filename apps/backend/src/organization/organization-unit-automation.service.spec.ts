import { describe, expect, it } from 'bun:test';
import { Weekday } from '../shared/enums/weekday.enum';
import { OrganizationUnitAutomationKind } from './enums';
import { OrganizationUnitAutomationService } from './organization-unit-automation.service';
import type { AutomationRow } from './utils/automation-resolution';

function serviceOverRows(rows: AutomationRow[]): {
  service: OrganizationUnitAutomationService;
  queryCount: () => number;
} {
  let queries = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => {
          queries += 1;
          return Promise.resolve(rows);
        },
      }),
    }),
  };

  return {
    service: new OrganizationUnitAutomationService(db as never),
    queryCount: () => queries,
  };
}

function serviceWithUnreachableDb(): OrganizationUnitAutomationService {
  const db = {
    query: {
      organizationUnits: {
        findFirst: () => {
          throw new Error('database should not be reached');
        },
      },
    },
  };
  return new OrganizationUnitAutomationService(db as never);
}

async function expectRejection(
  kind: OrganizationUnitAutomationKind,
  patch: Record<string, unknown>,
): Promise<string> {
  try {
    await serviceWithUnreachableDb().update('unit-1', kind, patch);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the update to be rejected');
}

describe('OrganizationUnitAutomationService.update validation', () => {
  it('rejects a lead time on the discovery email', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
      { leadTimeHours: 48 },
    );
    expect(message).toContain('does not take a lead time');
  });

  it('rejects a send time on the urgent call', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.URGENT_CALL,
      { sendAtTime: '08:00' },
    );
    expect(message).toContain('does not take a send time');
  });

  it('rejects a lead time outside the offered options', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.PAUSE_APPROVAL,
      { leadTimeHours: 36 },
    );
    expect(message).toContain('12, 24, 48, 72');
  });

  it('rejects clearing a lead time the automation needs', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.URGENT_CALL,
      { leadTimeHours: null },
    );
    expect(message).toContain('requires a lead time');
  });

  it('rejects a send time that is not HH:MM', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
      { sendAtTime: '25:00' },
    );
    expect(message).toContain('HH:MM');
  });

  it('rejects unknown weekdays', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.URGENT_CALL,
      { activeDays: ['FUNDAY'] },
    );
    expect(message).toContain('Unknown weekdays');
  });

  it('accepts a valid patch and reaches the database', async () => {
    const message = await expectRejection(
      OrganizationUnitAutomationKind.URGENT_CALL,
      { enabled: true, activeDays: [Weekday.SATURDAY], leadTimeHours: 24 },
    );
    expect(message).toBe('database should not be reached');
  });
});

describe('OrganizationUnitAutomationService.resolveMany', () => {
  function urgentCallRow(
    organizationUnitId: string,
    leadTimeHours: number,
  ): AutomationRow {
    return {
      organizationUnitId,
      kind: OrganizationUnitAutomationKind.URGENT_CALL,
      enabled: true,
      activeDays: [Weekday.SATURDAY],
      leadTimeHours,
      sendAtTime: null,
    };
  }

  it('gives each unit its own settings', async () => {
    const { service } = serviceOverRows([
      urgentCallRow('branch-a', 12),
      urgentCallRow('branch-b', 72),
    ]);

    const resolved = await service.resolveMany(
      ['branch-a', 'branch-b'],
      OrganizationUnitAutomationKind.URGENT_CALL,
    );

    expect(resolved.get('branch-a')?.leadTimeHours).toBe(12);
    expect(resolved.get('branch-b')?.leadTimeHours).toBe(72);
  });

  it('does not let a parent unit stand in for a sub unit', async () => {
    const { service } = serviceOverRows([urgentCallRow('root', 72)]);

    const resolved = await service.resolveMany(
      ['branch-a'],
      OrganizationUnitAutomationKind.URGENT_CALL,
    );

    expect(resolved.get('branch-a')?.enabled).toBe(false);
    expect(resolved.get('branch-a')?.leadTimeHours).toBe(48);
  });

  it('resolves many units in a single query', async () => {
    const { service, queryCount } = serviceOverRows([]);

    await service.resolveMany(
      ['branch-a', 'branch-b', 'branch-c'],
      OrganizationUnitAutomationKind.URGENT_CALL,
    );

    expect(queryCount()).toBe(1);
  });

  it('returns an empty map without querying when given no units', async () => {
    const { service, queryCount } = serviceOverRows([]);

    const resolved = await service.resolveMany(
      [],
      OrganizationUnitAutomationKind.URGENT_CALL,
    );

    expect(resolved.size).toBe(0);
    expect(queryCount()).toBe(0);
  });
});

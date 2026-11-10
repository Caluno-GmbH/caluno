import { describe, expect, it } from 'bun:test';
import { TaskType } from '@repo/data';
import {
  billingMonthBounds,
  billingYearBounds,
} from '@/domain/accounting/lib/billing-period';
import { mapOverviewTask } from './map-task';
import type { OverviewSourceTask } from './visible-tasks';

const ORG = 'org-1';

function source(
  type: OverviewSourceTask['type'],
  data: Record<string, unknown>,
): OverviewSourceTask {
  return {
    id: `${type}-1`,
    type,
    link: `/admin/${ORG}/target`,
    data,
    organizationUnitId: ORG,
    neededPermission: null,
  };
}

function values(task: { details: { value: string }[] }): string[] {
  return task.details.map((detail) => detail.value);
}

describe('mapOverviewTask', () => {
  it('formats a shift below minimum with date, time, approved count, and minimum', () => {
    const task = mapOverviewTask(
      source(TaskType.ShiftBelowMinimum, {
        title: 'Reading hour',
        startsAt: '2026-08-12T08:00:00.000Z',
        endsAt: '2026-08-12T10:00:00.000Z',
        approvedCount: 1,
        minimum: 3,
      }),
      'en',
    );

    const detailValues = values(task);
    expect(task.href).toBe(`/admin/${ORG}/target`);
    expect(detailValues[0]).toBe('Reading hour');
    expect(detailValues).toContain('1');
    expect(detailValues).toContain('3');
    expect(detailValues.at(-2)).toBe('1');
    expect(detailValues.at(-1)).toBe('3');
    expect(detailValues).toContain('2026-08-12T08:00:00.000Z');
    expect(detailValues).toContain('2026-08-12T10:00:00.000Z');
  });

  it('formats open join requests for a shift and an event', () => {
    const data = {
      title: 'Summer fair',
      startsAt: '2026-08-12T08:00:00.000Z',
      endsAt: '2026-08-12T12:00:00.000Z',
      openRequestCount: 4,
    };

    for (const type of [TaskType.ShiftApproval, TaskType.EventApproval]) {
      const task = mapOverviewTask(source(type, data), 'en');
      const detailValues = values(task);
      expect(detailValues[0]).toBe('Summer fair');
      expect(detailValues.at(-1)).toBe('4');
    }
  });

  it('formats a membership request with both names and the request date', () => {
    const task = mapOverviewTask(
      source(TaskType.MembershipRequest, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@caluno.org',
        requestedAt: '2026-03-04T09:00:00.000Z',
      }),
      'en',
    );

    const detailValues = values(task);
    expect(detailValues.slice(0, 3)).toEqual([
      'Ada',
      'Lovelace',
      'ada@caluno.org',
    ]);
    expect(detailValues[3]).toMatch(/2026/);
  });

  it('labels a countersign contract as a year, a month, or a range', () => {
    const year = billingYearBounds(2026);
    const month = billingMonthBounds(2026, 7);
    const yearTask = mapOverviewTask(
      source(TaskType.ContractSign, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        ...year,
      }),
      'en',
    );
    const monthTask = mapOverviewTask(
      source(TaskType.ContractSign, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Übungsleiterpauschale',
        ...month,
      }),
      'en',
    );
    const rangeTask = mapOverviewTask(
      source(TaskType.ContractSign, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        periodStart: '2026-03-04T23:00:00.000Z',
        periodEnd: '2026-06-15T22:00:00.000Z',
      }),
      'en',
    );

    expect(values(yearTask)).toEqual([
      'Ada Lovelace',
      'Ehrenamtspauschale',
      '2026',
    ]);
    const keyed = mapOverviewTask(
      source(TaskType.ContractSign, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeKey: 'EHRENAMT',
        ...year,
      }),
      'en',
      { reimbursementType: (key) => (key === 'EHRENAMT' ? 'Ehrenamt' : key) },
    );
    expect(values(keyed)[1]).toBe('Ehrenamt');
    expect(values(monthTask)[2]).toBe('August 2026');
    expect(values(rangeTask)[2]).not.toBe('15/06/2026');
    expect(values(rangeTask)[2]).toContain('–');
  });

  it('formats a timesheet to sign with month, hours, and amount', () => {
    const task = mapOverviewTask(
      source(TaskType.TimesheetSign, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        month: '2026-09',
        hours: 12.5,
        amountCents: 4500,
      }),
      'en',
    );

    const detailValues = values(task);
    expect(detailValues.slice(0, 4)).toEqual([
      'Ada Lovelace',
      'Ehrenamtspauschale',
      'September 2026',
      '12.5',
    ]);
    expect(detailValues[4]?.replace(/\u00a0/g, ' ')).toBe('45,00 €');
  });

  it('formats a timesheet still to create like a timesheet to sign', () => {
    const month = billingMonthBounds(2026, 8);
    const task = mapOverviewTask(
      source(TaskType.InvoiceCreate, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeKey: 'EHRENAMT',
        ...month,
        hours: 5,
        amountCents: 600,
      }),
      'en',
      { reimbursementType: (key) => (key === 'EHRENAMT' ? 'Ehrenamt' : key) },
    );

    expect(task.documentKind).toBe('invoice');
    expect(values(task).slice(0, 3)).toEqual([
      'Ada Lovelace',
      'Ehrenamt',
      'September 2026',
    ]);
  });

  it('formats a contract still to create like a countersign contract', () => {
    const year = billingYearBounds(2026);
    const task = mapOverviewTask(
      source(TaskType.ContractCreate, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        ...year,
        kind: 'generate',
      }),
      'en',
    );

    expect(task.documentKind).toBe('contract');
    expect(values(task)).toEqual([
      'Ada Lovelace',
      'Ehrenamtspauschale',
      '2026',
    ]);
  });

  it('counts every ready unpaid timesheet on a bundle card', () => {
    const task = mapOverviewTask(
      source(TaskType.TimesheetBundles, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        readyCount: 6,
        amountCents: 9600,
      }),
      'en',
    );

    const details = values(task);
    expect(details.slice(0, 3)).toEqual([
      'Ada Lovelace',
      'Ehrenamtspauschale',
      '6',
    ]);
    expect(details[3]?.replace(/\u00a0/g, ' ')).toBe('96,00 €');
  });

  it('formats a volunteer-declined document with the decline reason', () => {
    const month = billingMonthBounds(2026, 5);
    const task = mapOverviewTask(
      source(TaskType.DocumentDeclined, {
        volunteerName: 'Ada Lovelace',
        reimbursementTypeName: 'Ehrenamtspauschale',
        ...month,
        declineReason: 'Wrong hours',
        declinedAtSigneeType: 'VOLUNTEER',
      }),
      'en',
    );

    expect(values(task)).toEqual([
      'Ada Lovelace',
      'Ehrenamtspauschale',
      'June 2026',
      'Wrong hours',
    ]);
  });

  it('sorts declined and countersign documents by the status change', () => {
    const declined = mapOverviewTask(
      source(TaskType.DocumentDeclined, {
        volunteerName: 'Ada Lovelace',
        periodStart: '2026-02-01T00:00:00.000Z',
        declinedAt: '2026-09-20T08:00:00.000Z',
      }),
      'en',
    );
    const signed = mapOverviewTask(
      source(TaskType.ContractSign, {
        volunteerName: 'Ada Lovelace',
        periodStart: '2026-01-01T00:00:00.000Z',
        signedAt: '2026-08-15T10:00:00.000Z',
      }),
      'en',
    );

    expect(declined.sortAt).toBe('2026-09-20T08:00:00.000Z');
    expect(signed.sortAt).toBe('2026-08-15T10:00:00.000Z');
  });
});

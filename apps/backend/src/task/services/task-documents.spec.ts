import { describe, expect, it } from 'bun:test';
import { DocumentKind } from '../../accounting/enums';
import { TaskType } from '../enums/task-type.enum';
import {
  type ContractTaskRow,
  countersignContractTasks,
  createContractDraftTasks,
  createContractGenerateTasks,
  createInvoiceTasks,
  declinedDocumentTasks,
  type InvoiceTaskRow,
  type TimesheetCreateRow,
  timesheetBundleTasks,
  timesheetSignTasks,
} from './task-documents';

const ORG = 'org-1';
const start = new Date('2026-08-01T00:00:00.000Z');
const end = new Date('2026-09-01T00:00:00.000Z');

function contract(overrides: Partial<ContractTaskRow> = {}): ContractTaskRow {
  return {
    id: 'contract-1',
    volunteerId: 'volunteer-1',
    volunteerName: 'Ada Lovelace',
    reimbursementTypeKey: 'EHRENAMT',
    periodStart: start,
    periodEnd: end,
    status: 'AWAITING_NGO_SIGNATURE',
    declinedAtSigneeType: null,
    declineReason: null,
    declinedAt: null,
    volunteerSignedAt: null,
    ...overrides,
  };
}

function invoice(overrides: Partial<InvoiceTaskRow> = {}): InvoiceTaskRow {
  return {
    ...contract(),
    id: 'invoice-1',
    status: 'AWAITING_SUPERVISOR_SIGNATURE',
    totalHours: 4,
    totalAmountCents: 1600,
    paidAt: null,
    ...overrides,
  };
}

describe('document tasks', () => {
  it('keeps contracts waiting for the organisation signature', () => {
    const tasks = countersignContractTasks(
      [
        contract({
          volunteerSignedAt: new Date('2026-08-20T10:00:00.000Z'),
        }),
        contract({ id: 'active', status: 'ACTIVE' }),
      ],
      ORG,
    );

    expect(tasks.map((task) => task.id)).toEqual(['contract-1']);
    expect(tasks[0]?.type).toBe(TaskType.CONTRACT_SIGN);
    expect(tasks[0]?.data).toMatchObject({
      volunteerName: 'Ada Lovelace',
      reimbursementTypeKey: 'EHRENAMT',
      signedAt: '2026-08-20T10:00:00.000Z',
    });
  });

  it('signs one timesheet with hours and amount', () => {
    const tasks = timesheetSignTasks([invoice()], ORG);
    expect(tasks[0]?.data).toMatchObject({ hours: 4, amountCents: 1600 });
  });

  it('counts every unpaid ready timesheet for a volunteer and type', () => {
    const tasks = timesheetBundleTasks(
      [
        invoice({ id: 'a', status: 'READY' }),
        invoice({
          id: 'b',
          status: 'READY',
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
        }),
        invoice({ id: 'paid', status: 'READY', paidAt: new Date() }),
        invoice({
          id: 'other-type',
          status: 'READY',
          reimbursementTypeKey: 'UEBUNGSLEITER',
        }),
      ],
      ORG,
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          volunteerName: 'Ada Lovelace',
          reimbursementTypeKey: 'EHRENAMT',
          readyCount: 2,
          amountCents: 3200,
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          reimbursementTypeKey: 'UEBUNGSLEITER',
          readyCount: 1,
        }),
      }),
    ]);
  });

  it('drops a volunteer decline once a replacement exists, and skips org declines', () => {
    const tasks = declinedDocumentTasks(
      [
        contract({
          id: 'open',
          status: 'DECLINED',
          declinedAtSigneeType: 'VOLUNTEER',
          declineReason: 'Wrong hours',
          declinedAt: new Date('2026-09-01T08:00:00.000Z'),
        }),
        contract({
          id: 'replaced',
          volunteerId: 'volunteer-2',
          status: 'DECLINED',
          declinedAtSigneeType: 'VOLUNTEER',
        }),
        contract({
          id: 'replacement',
          volunteerId: 'volunteer-2',
          status: 'DRAFT',
        }),
        contract({
          id: 'org',
          status: 'DECLINED',
          declinedAtSigneeType: 'PERMISSION_HOLDER',
        }),
      ],
      ORG,
      DocumentKind.INVOICE,
    );

    expect(tasks.map((task) => task.id)).toEqual(['open']);
    expect(tasks[0]?.data).toMatchObject({
      declineReason: 'Wrong hours',
      declinedAtSigneeType: 'VOLUNTEER',
      declinedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('queues DRAFT contracts as create-agreement tasks', () => {
    const tasks = createContractDraftTasks(
      [
        contract({ id: 'draft', status: 'DRAFT' }),
        contract({ id: 'active', status: 'ACTIVE' }),
      ],
      ORG,
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.type).toBe(TaskType.CONTRACT_CREATE);
    expect(tasks[0]?.id).toBe('draft');
  });

  it('queues unclaimed paid hours as create-timesheet tasks', () => {
    const row: TimesheetCreateRow = {
      volunteerId: 'volunteer-1',
      volunteerName: 'Ada Lovelace',
      reimbursementTypeId: 'rt-1',
      reimbursementTypeKey: 'EHRENAMT',
      periodStart: start,
      periodEnd: end,
      eligibleHours: 5,
      estimatedAmountCents: 600,
      hasUncoveredHours: false,
      firstUncoveredAt: null,
    };

    const tasks = createInvoiceTasks([row], ORG);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.type).toBe(TaskType.INVOICE_CREATE);
    expect(tasks[0]?.data).toMatchObject({
      hours: 5,
      amountCents: 600,
      volunteerName: 'Ada Lovelace',
    });
  });

  it('synthesizes one create-agreement reminder for uncovered hours', () => {
    const tasks = createContractGenerateTasks(
      [
        {
          volunteerId: 'volunteer-1',
          volunteerName: 'Ada Lovelace',
          reimbursementTypeId: 'rt-1',
          reimbursementTypeKey: 'EHRENAMT',
          periodStart: start,
          periodEnd: end,
          eligibleHours: 5,
          estimatedAmountCents: 600,
          hasUncoveredHours: true,
          firstUncoveredAt: start,
        },
        {
          volunteerId: 'volunteer-1',
          volunteerName: 'Ada Lovelace',
          reimbursementTypeId: 'rt-1',
          reimbursementTypeKey: 'EHRENAMT',
          periodStart: new Date('2026-09-01T00:00:00.000Z'),
          periodEnd: new Date('2026-10-01T00:00:00.000Z'),
          eligibleHours: 2,
          estimatedAmountCents: 240,
          hasUncoveredHours: true,
          firstUncoveredAt: new Date('2026-09-05T00:00:00.000Z'),
        },
        {
          volunteerId: 'volunteer-1',
          volunteerName: 'Ada Lovelace',
          reimbursementTypeId: 'rt-1',
          reimbursementTypeKey: 'EHRENAMT',
          periodStart: new Date('2026-07-01T00:00:00.000Z'),
          periodEnd: new Date('2026-08-01T00:00:00.000Z'),
          eligibleHours: 1,
          estimatedAmountCents: 120,
          hasUncoveredHours: false,
          firstUncoveredAt: null,
        },
      ],
      [],
      ORG,
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.type).toBe(TaskType.CONTRACT_CREATE);
    expect(tasks[0]?.id).toBe('contract-generate:volunteer-1:EHRENAMT');
    expect(tasks[0]?.data).toMatchObject({
      kind: 'generate',
      periodStart: start.toISOString(),
    });
  });

  it('falls back to a paid-shift signup when hours are already covered', () => {
    const signupStart = new Date('2026-08-31T22:00:00.000Z');
    const tasks = createContractGenerateTasks(
      [
        {
          volunteerId: 'volunteer-1',
          volunteerName: 'Ada Lovelace',
          reimbursementTypeId: 'rt-1',
          reimbursementTypeKey: 'EHRENAMT',
          periodStart: start,
          periodEnd: end,
          eligibleHours: 5,
          estimatedAmountCents: 600,
          hasUncoveredHours: false,
          firstUncoveredAt: null,
        },
      ],
      [
        {
          volunteerId: 'volunteer-1',
          volunteerName: 'Ada Lovelace',
          reimbursementTypeId: 'rt-1',
          reimbursementTypeKey: 'EHRENAMT',
          periodStart: signupStart,
          periodEnd: end,
        },
      ],
      ORG,
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.data).toMatchObject({
      kind: 'generate',
      periodStart: signupStart.toISOString(),
    });
  });
});

import { describe, expect, it } from 'bun:test';
import {
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  PermissionKey,
  ReimbursementTypeKey,
  SigneeType,
} from '@repo/data';
import type {
  BoardDocument,
  BoardVolunteer,
  DocStatus,
} from '../components/reimbursements-board';
import { STATUS_META } from '../components/reimbursements-volunteer-group';
import {
  boardYear,
  buildBoardVolunteers,
  contractPeriodOverlapsYear,
  contractStatusToDocStatus,
  creationTargetFor,
  documentRowAction,
  formatMonthYear,
  getContractStateForPicker,
  getDocLineSummary,
  getInitials,
  getLatestTimesheetPeriod,
  getPickerAnnotations,
  invoiceInMonth,
  invoiceStatusToDocStatus,
  mapContractToBoardDoc,
  mapDeclinedAtRole,
  mapInvoiceToBoardDoc,
  mapSignatureToSignee,
  monthsInRange,
} from './board-data.utils';

const ehrenamtType = {
  id: 'rt-ehrenamt',
  key: ReimbursementTypeKey.Ehrenamt,
  legalReference: '',
  yearlyLimitCents: 84_000,
  platformDefaultRateCents: 450,
};

const _uebungsleiterType = {
  id: 'rt-uebungsleiter',
  key: ReimbursementTypeKey.Uebungsleiter,
  legalReference: '',
  yearlyLimitCents: 300_000,
  platformDefaultRateCents: 1_200,
};

function makeContract(
  overrides: Partial<Parameters<typeof mapContractToBoardDoc>[0]> & {
    contractStatus?: ContractStatus;
  },
) {
  return {
    id: 'c-1',
    contractStatus: ContractStatus.AwaitingVolunteerSignature,
    // 2026 as Berlin calendar-year bounds, the shape the app persists.
    periodStart: '2025-12-31T23:00:00.000Z',
    periodEnd: '2026-12-31T23:00:00.000Z',
    isNonCompliant: false,
    declineReason: null,
    declinedAt: null,
    declinedAtSigneeType: null,
    declinedByUser: null,
    renewDate: null,
    downloadUrl: null,
    missingProfileFields: [],
    missingOrgProfileFields: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
    reimbursementType: ehrenamtType,
    documentTemplate: {
      id: 'dt-1',
      kind: DocumentKind.Contract,
      reimbursementType: ehrenamtType,
    },
    signatures: [],
    statusChanges: [],
    ...overrides,
  };
}

function makeInvoice(
  overrides: Partial<Parameters<typeof mapInvoiceToBoardDoc>[0]> & {
    invoiceStatus?: InvoiceStatus;
  },
) {
  return {
    id: 'i-1',
    invoiceStatus: InvoiceStatus.AwaitingVolunteerSignature,
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T23:59:59.000Z',
    totalAmountCents: 12_000,
    totalHours: 8,
    isNonCompliant: false,
    declineReason: null,
    declinedAt: null,
    declinedAtSigneeType: null,
    declinedByUser: null,
    downloadUrl: null,
    missingProfileFields: [],
    missingOrgProfileFields: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: null,
    volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
    reimbursementType: ehrenamtType,
    documentTemplate: {
      id: 'dt-2',
      kind: DocumentKind.Invoice,
      reimbursementType: ehrenamtType,
    },
    invoiceTimeEntries: [],
    signatures: [],
    statusChanges: [],
    ...overrides,
  };
}

describe('getInitials', () => {
  it('returns first letters of first and last name', () => {
    expect(getInitials('Anna Müller')).toBe('AM');
    expect(getInitials('Ben Schmidt')).toBe('BS');
  });

  it('returns single initial for one name', () => {
    expect(getInitials('Madonna')).toBe('M');
  });
});

describe('contractStatusToDocStatus', () => {
  it('maps contract statuses to board statuses', () => {
    expect(
      contractStatusToDocStatus(ContractStatus.AwaitingVolunteerSignature),
    ).toBe('contract-signing-vol');
    expect(contractStatusToDocStatus(ContractStatus.AwaitingNgoSignature)).toBe(
      'contract-signing-coord',
    );
    expect(contractStatusToDocStatus(ContractStatus.Active)).toBe(
      'contract-active',
    );
    expect(contractStatusToDocStatus(ContractStatus.Expired)).toBe(
      'contract-expired',
    );
    expect(contractStatusToDocStatus(ContractStatus.Declined)).toBe(
      'contract-declined',
    );
  });

  it('maps ContractStatus.Draft to contract-draft', () => {
    expect(contractStatusToDocStatus(ContractStatus.Draft)).toBe(
      'contract-draft',
    );
  });
});

describe('invoiceStatusToDocStatus', () => {
  it('maps invoice statuses to board statuses', () => {
    expect(
      invoiceStatusToDocStatus(InvoiceStatus.AwaitingVolunteerSignature),
    ).toBe('timesheet-signing-vol');
    expect(
      invoiceStatusToDocStatus(InvoiceStatus.AwaitingSupervisorSignature),
    ).toBe('timesheet-signing-super');
    expect(invoiceStatusToDocStatus(InvoiceStatus.Ready)).toBe(
      'timesheet-ready',
    );
    expect(invoiceStatusToDocStatus(InvoiceStatus.Declined)).toBe(
      'timesheet-declined',
    );
  });
});

describe('mapDeclinedAtRole', () => {
  it('maps volunteer signee type', () => {
    expect(mapDeclinedAtRole(SigneeType.Volunteer, 'contract')).toBe(
      'volunteer',
    );
  });

  it('maps permission holder to coordinator for contracts', () => {
    expect(mapDeclinedAtRole(SigneeType.PermissionHolder, 'contract')).toBe(
      'coordinator',
    );
  });

  it('maps permission holder to supervisor for invoices', () => {
    expect(mapDeclinedAtRole(SigneeType.PermissionHolder, 'invoice')).toBe(
      'supervisor',
    );
  });

  it('returns undefined for null/undefined', () => {
    expect(mapDeclinedAtRole(null, 'contract')).toBeUndefined();
    expect(mapDeclinedAtRole(undefined, 'invoice')).toBeUndefined();
  });
});

describe('mapSignatureToSignee', () => {
  it('maps volunteer signature', () => {
    const signee = mapSignatureToSignee(
      {
        id: 's-1',
        order: 0,
        signeeType: SigneeType.Volunteer,
        signedAt: null,
        signedByUser: null,
        requiredPermission: null,
      },
      'contract',
    );
    expect(signee.role).toBe('volunteer');
  });

  it('maps permission holder signature to coordinator for contracts', () => {
    const signee = mapSignatureToSignee(
      {
        id: 's-2',
        order: 1,
        signeeType: SigneeType.PermissionHolder,
        signedAt: null,
        signedByUser: null,
        requiredPermission: { id: 'p-1', key: PermissionKey.AccountingManage },
      },
      'contract',
    );
    expect(signee.role).toBe('coordinator');
  });

  it('carries the signing users name, when the agreement has been signed', () => {
    const signee = mapSignatureToSignee(
      {
        id: 's-3',
        order: 1,
        signeeType: SigneeType.PermissionHolder,
        signedAt: '2026-03-02T00:00:00.000Z',
        signedByUser: { id: 'u-1', name: 'Boo-Boo' },
        requiredPermission: { id: 'p-1', key: PermissionKey.AccountingManage },
      },
      'contract',
    );
    expect(signee.signedByName).toBe('Boo-Boo');
  });

  it('leaves the signing users name empty, when the agreement has not signed', () => {
    const signee = mapSignatureToSignee(
      {
        id: 's-4',
        order: 1,
        signeeType: SigneeType.PermissionHolder,
        signedAt: null,
        signedByUser: null,
        requiredPermission: { id: 'p-1', key: PermissionKey.AccountingManage },
      },
      'invoice',
    );
    expect(signee.signedByName).toBeUndefined();
  });
});

describe('mapContractToBoardDoc', () => {
  it('maps a contract to a board document', () => {
    const doc = mapContractToBoardDoc(makeContract({}), 'ehrenamt', 'de');
    expect(doc.status).toBe('contract-signing-vol');
    expect(doc.periodLabel).toBe('2026');
    expect(doc.pauschale).toBe('ehrenamt');
    expect(doc.lastActionDate).toBeInstanceOf(Date);
  });

  // VOLI-1370: a contract's label must state the period the agreement does,
  // not always the calendar year.
  it('labels a month-scoped contract by its month', () => {
    const doc = mapContractToBoardDoc(
      makeContract({
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
      }),
      'uebungsleiter',
      'de',
    );
    expect(doc.periodLabel).toBe('August 2026');
  });

  // VOLI-1370: an ACTIVE contract past its period is not current cover.
  it('shows an ACTIVE contract whose period has ended as expired', () => {
    const doc = mapContractToBoardDoc(
      makeContract({
        contractStatus: ContractStatus.Active,
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
      }),
      'ehrenamt',
      'de',
      new Date('2026-09-15T12:00:00.000Z'),
    );
    expect(doc.status).toBe('contract-expired');
  });

  it('keeps an ACTIVE contract inside its period as active', () => {
    const doc = mapContractToBoardDoc(
      makeContract({
        contractStatus: ContractStatus.Active,
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
      }),
      'ehrenamt',
      'de',
      new Date('2026-08-15T12:00:00.000Z'),
    );
    expect(doc.status).toBe('contract-active');
  });

  // VOLI-1246: the admin's document sheet needs to show who declined a
  // document, alongside the reason and date — the GraphQL fragment already
  // fetches declinedByUser, so this just has to reach the board doc.
  it('surfaces who declined the contract', () => {
    const doc = mapContractToBoardDoc(
      makeContract({
        contractStatus: ContractStatus.Declined,
        declineReason: 'Terms are not acceptable',
        declinedAt: '2026-03-01T00:00:00.000Z',
        declinedAtSigneeType: SigneeType.Volunteer,
        declinedByUser: { id: 'v-1', name: 'Anna Müller' },
      }),
      'ehrenamt',
      'de',
    );
    expect(doc.status).toBe('contract-declined');
    expect(doc.declineReason).toBe('Terms are not acceptable');
    expect(doc.declinedBy).toBe('Anna Müller');
    expect(doc.declinedAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });
});

describe('mapInvoiceToBoardDoc', () => {
  it('maps an invoice to a board document', () => {
    const doc = mapInvoiceToBoardDoc(makeInvoice({}), 'ehrenamt', 'de');
    expect(doc.status).toBe('timesheet-signing-vol');
    expect(doc.amount).toBe(120);
    expect(doc.hours).toBe(8);
    expect(doc.periodLabel).toContain('2026');
    expect(doc.pauschale).toBe('ehrenamt');
  });

  it('surfaces who declined the invoice', () => {
    const doc = mapInvoiceToBoardDoc(
      makeInvoice({
        invoiceStatus: InvoiceStatus.Declined,
        declineReason: 'Wrong hours',
        declinedAt: '2026-03-01T00:00:00.000Z',
        declinedAtSigneeType: SigneeType.Volunteer,
        declinedByUser: { id: 'v-1', name: 'Anna Müller' },
      }),
      'ehrenamt',
      'de',
    );
    expect(doc.status).toBe('timesheet-declined');
    expect(doc.declineReason).toBe('Wrong hours');
    expect(doc.declinedBy).toBe('Anna Müller');
    expect(doc.declinedAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });
});

describe('contractPeriodOverlapsYear', () => {
  it('returns true when contract overlaps year', () => {
    expect(contractPeriodOverlapsYear(makeContract({}), 2026)).toBe(true);
    expect(
      contractPeriodOverlapsYear(
        makeContract({ periodStart: '2025-07-01', periodEnd: '2026-06-30' }),
        2026,
      ),
    ).toBe(true);
  });

  it('returns false when contract is in a different year', () => {
    expect(
      contractPeriodOverlapsYear(
        makeContract({ periodStart: '2025-01-01', periodEnd: '2025-12-31' }),
        2026,
      ),
    ).toBe(false);
  });
});

describe('invoiceInMonth', () => {
  it('matches invoice period start to month', () => {
    expect(invoiceInMonth(makeInvoice({}), 2026, 6)).toBe(true); // July is 6
    expect(invoiceInMonth(makeInvoice({}), 2026, 5)).toBe(false);
    expect(invoiceInMonth(makeInvoice({}), 2025, 6)).toBe(false);
  });
});

describe('formatMonthYear', () => {
  it('formats with locale', () => {
    expect(formatMonthYear(new Date(2026, 6, 1), 'de')).toContain('Juli');
    expect(formatMonthYear(new Date(2026, 6, 1), 'en')).toContain('July');
  });
});

describe('monthsInRange', () => {
  it('returns all twelve months of the year when no range (all time)', () => {
    const months = monthsInRange(2026, undefined);
    expect(months).toHaveLength(12);
    expect(months.map((m) => m.month)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(months.every((m) => m.year === 2026)).toBe(true);
  });

  it('returns all months between from and to inclusive', () => {
    const months = monthsInRange(2026, {
      from: new Date(2026, 5, 15),
      to: new Date(2026, 7, 10),
    });
    expect(months.map((m) => m.month)).toEqual([5, 6, 7]);
  });
});

describe('buildBoardVolunteers', () => {
  const noDocsVolunteer = {
    volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
    usageByType: [
      {
        usedCents: 0,
        limitCents: 84_000,
        remainingCents: 84_000,
        reimbursementType: ehrenamtType,
      },
    ],
  };

  it('returns no documents for a volunteer with no contract or invoice', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [],
      invoices: [],
      year: 2026,
      locale: 'de',
    });
    expect(volunteers).toHaveLength(1);
    expect(volunteers[0]?.documents).toEqual([]);
  });

  describe('timesheets to create', () => {
    const activeContract = makeContract({
      id: 'c-active',
      contractStatus: ContractStatus.Active,
    });
    const timesheetsToCreate = [
      {
        volunteerId: 'v-1',
        reimbursementTypeId: 'rt-ehrenamt',
        // July and August 2026 as Berlin calendar months.
        periodStart: '2026-06-30T22:00:00.000Z',
        periodEnd: '2026-07-31T22:00:00.000Z',
        eligibleHours: 6.5,
        estimatedAmountCents: 2_925,
      },
      {
        volunteerId: 'v-1',
        reimbursementTypeId: 'rt-ehrenamt',
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
        eligibleHours: 1,
        estimatedAmountCents: 450,
      },
    ];

    it('adds one row per volunteer, Pauschale and month with the summed hours', () => {
      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [activeContract],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate,
      });

      const rows = (volunteers[0]?.documents ?? []).filter(
        (doc) => doc.status === 'timesheet-generate',
      );
      expect(rows).toEqual([
        {
          id: 'v-1-timesheet-generate-ehrenamt-2026-07',
          status: 'timesheet-generate',
          pauschale: 'ehrenamt',
          hours: 6.5,
          amount: 29.25,
          periodLabel: formatMonthYear(
            new Date('2026-06-30T22:00:00.000Z'),
            'de',
          ),
          periodStart: new Date('2026-06-30T22:00:00.000Z'),
          periodEnd: new Date('2026-07-31T22:00:00.000Z'),
        },
        {
          id: 'v-1-timesheet-generate-ehrenamt-2026-08',
          status: 'timesheet-generate',
          pauschale: 'ehrenamt',
          hours: 1,
          amount: 4.5,
          periodLabel: formatMonthYear(
            new Date('2026-07-31T22:00:00.000Z'),
            'de',
          ),
          periodStart: new Date('2026-07-31T22:00:00.000Z'),
          periodEnd: new Date('2026-08-31T22:00:00.000Z'),
        },
      ]);
    });

    it('only adds rows for months in the selected range', () => {
      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [activeContract],
        invoices: [],
        year: 2026,
        locale: 'de',
        dateRange: { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) },
        timesheetsToCreate,
      });

      const rows = (volunteers[0]?.documents ?? []).filter(
        (doc) => doc.status === 'timesheet-generate',
      );
      expect(rows.map((row) => row.id)).toEqual([
        'v-1-timesheet-generate-ehrenamt-2026-08',
      ]);
    });

    it('suppresses the timesheet and queues the contract when hours have no covering contract', () => {
      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate,
      });

      const docs = volunteers[0]?.documents ?? [];
      expect(docs.map((d) => d.status)).toEqual(['contract-generate']);
      expect(docs[0]?.periodLabel).toBe('Juli 2026');
    });

    // VOLI-1370: an ACTIVE contract for one month must not cover hours in
    // another month. The uncovered month gets a reminder instead of a payment.
    it('does not create a timesheet for a month outside the active contract', () => {
      const augustContract = makeContract({
        id: 'c-august',
        contractStatus: ContractStatus.Active,
        // August 2026 as Berlin bounds.
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
      });

      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [augustContract],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate: [
          {
            volunteerId: 'v-1',
            reimbursementTypeId: 'rt-ehrenamt',
            // September 2026 as Berlin bounds.
            periodStart: '2026-08-31T22:00:00.000Z',
            periodEnd: '2026-09-30T22:00:00.000Z',
            eligibleHours: 5,
            estimatedAmountCents: 600,
          },
        ],
      });

      const docs = volunteers[0]?.documents ?? [];
      expect(docs.some((d) => d.status === 'timesheet-generate')).toBe(false);
      const reminder = docs.find((d) => d.status === 'contract-generate');
      expect(reminder?.periodLabel).toBe('September 2026');
    });

    it('still creates a timesheet for a month the active contract covers', () => {
      const augustContract = makeContract({
        id: 'c-august',
        contractStatus: ContractStatus.Active,
        periodStart: '2026-07-31T22:00:00.000Z',
        periodEnd: '2026-08-31T22:00:00.000Z',
      });

      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [augustContract],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate: [
          {
            volunteerId: 'v-1',
            reimbursementTypeId: 'rt-ehrenamt',
            periodStart: '2026-07-31T22:00:00.000Z',
            periodEnd: '2026-08-31T22:00:00.000Z',
            eligibleHours: 5,
            estimatedAmountCents: 600,
          },
        ],
      });

      const docs = volunteers[0]?.documents ?? [];
      expect(
        docs.filter((d) => d.status === 'timesheet-generate'),
      ).toHaveLength(1);
      expect(docs.some((d) => d.status === 'contract-generate')).toBe(false);
    });

    // VOLI-1370 / PM: until both parties have signed there is no valid
    // contract, so a covering draft must not release the payment.
    it('does not create a timesheet for a month only a DRAFT contract covers', () => {
      const september = {
        volunteerId: 'v-1',
        reimbursementTypeId: 'rt-ehrenamt',
        // September 2026 as Berlin bounds.
        periodStart: '2026-08-31T22:00:00.000Z',
        periodEnd: '2026-09-30T22:00:00.000Z',
        eligibleHours: 5,
        estimatedAmountCents: 600,
      };
      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [
          makeContract({
            id: 'c-draft',
            contractStatus: ContractStatus.Draft,
            periodStart: '2026-08-31T22:00:00.000Z',
            periodEnd: '2026-09-30T22:00:00.000Z',
          }),
        ],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate: [september],
      });

      const docs = volunteers[0]?.documents ?? [];
      expect(docs.some((d) => d.status === 'timesheet-generate')).toBe(false);
      // The draft is its own "create contract" task; no duplicate reminder.
      expect(docs.some((d) => d.status === 'contract-generate')).toBe(false);
      expect(docs.some((d) => d.status === 'contract-draft')).toBe(true);
    });

    it('does not create a timesheet for a month only an awaiting-signature contract covers', () => {
      const september = {
        volunteerId: 'v-1',
        reimbursementTypeId: 'rt-ehrenamt',
        periodStart: '2026-08-31T22:00:00.000Z',
        periodEnd: '2026-09-30T22:00:00.000Z',
        eligibleHours: 5,
        estimatedAmountCents: 600,
      };
      const volunteers = buildBoardVolunteers({
        rosterUsage: [noDocsVolunteer],
        contracts: [
          makeContract({
            id: 'c-pending',
            contractStatus: ContractStatus.AwaitingNgoSignature,
            periodStart: '2026-08-31T22:00:00.000Z',
            periodEnd: '2026-09-30T22:00:00.000Z',
          }),
        ],
        invoices: [],
        year: 2026,
        locale: 'de',
        timesheetsToCreate: [september],
      });

      const docs = volunteers[0]?.documents ?? [];
      expect(docs.some((d) => d.status === 'timesheet-generate')).toBe(false);
      expect(docs.some((d) => d.status === 'contract-generate')).toBe(false);
      expect(docs.some((d) => d.status === 'contract-signing-coord')).toBe(
        true,
      );
    });
  });

  it('does not synthesize a contract-generate row when an active contract exists', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [
        makeContract({ id: 'c-active', contractStatus: ContractStatus.Active }),
      ],
      invoices: [],
      year: 2026,
      locale: 'de',
      eligibleHoursVolunteers: new Map([['v-1', new Set(['rt-ehrenamt'])]]),
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.some((d) => d.status === 'contract-generate')).toBe(false);
    expect(docs.some((d) => d.status === 'contract-active')).toBe(true);
  });

  it('queues a volunteer with eligible hours but no Vereinbarung under contract-generate', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [],
      invoices: [],
      year: 2026,
      locale: 'de',
      eligibleHoursVolunteers: new Map([['v-1', new Set(['rt-ehrenamt'])]]),
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs).toHaveLength(1);
    expect(docs[0]?.status).toBe('contract-generate');
    expect(docs[0]?.pauschale).toBe('ehrenamt');
  });

  it('queues a volunteer with eligible hours and an uncountersigned Vereinbarung under contract-signing', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [
        makeContract({
          id: 'c-pending',
          contractStatus: ContractStatus.AwaitingNgoSignature,
        }),
      ],
      invoices: [],
      year: 2026,
      locale: 'de',
      eligibleHoursVolunteers: new Map([['v-1', new Set(['rt-ehrenamt'])]]),
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.some((d) => d.status === 'contract-generate')).toBe(false);
    expect(docs.some((d) => d.status === 'contract-signing-coord')).toBe(true);
  });

  it('queues a volunteer with a paid-shift signup but no Vereinbarung under contract-generate', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [],
      invoices: [],
      year: 2026,
      locale: 'de',
      paidShiftSignups: [
        {
          volunteerId: 'v-1',
          reimbursementTypeId: 'rt-ehrenamt',
          // September 2026 as Berlin bounds.
          periodStart: '2026-08-31T22:00:00.000Z',
          periodEnd: '2026-09-30T22:00:00.000Z',
        },
      ],
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs).toHaveLength(1);
    expect(docs[0]?.status).toBe('contract-generate');
    expect(docs[0]?.id).toBe('v-1-contract-generate-ehrenamt');
  });

  // VOLI-1370: the backend only returns paid-shift signups whose shift date no
  // valid contract covers, so the board surfaces the create task for each.
  it('surfaces the paid-shift create task for a signup the backend judged uncovered', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [
        makeContract({ id: 'c-active', contractStatus: ContractStatus.Active }),
      ],
      invoices: [],
      year: 2026,
      locale: 'de',
      paidShiftSignups: [
        {
          volunteerId: 'v-1',
          reimbursementTypeId: 'rt-ehrenamt',
          // September 2026 as Berlin bounds.
          periodStart: '2026-08-31T22:00:00.000Z',
          periodEnd: '2026-09-30T22:00:00.000Z',
        },
      ],
    });
    const docs = volunteers[0]?.documents ?? [];
    const reminder = docs.find((d) => d.status === 'contract-generate');
    expect(reminder).toBeDefined();
    // The reminder names the uncovered month, not the year (VOLI-1370).
    expect(reminder?.periodLabel).toBe('September 2026');
    expect(docs.some((d) => d.status === 'contract-active')).toBe(true);
  });

  it('dedupes the contract-generate row when a volunteer has both eligible hours and a paid-shift signup', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [noDocsVolunteer],
      contracts: [],
      invoices: [],
      year: 2026,
      locale: 'de',
      eligibleHoursVolunteers: new Map([['v-1', new Set(['rt-ehrenamt'])]]),
      paidShiftSignups: [
        {
          volunteerId: 'v-1',
          reimbursementTypeId: 'rt-ehrenamt',
          // September 2026 as Berlin bounds.
          periodStart: '2026-08-31T22:00:00.000Z',
          periodEnd: '2026-09-30T22:00:00.000Z',
        },
      ],
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.filter((d) => d.status === 'contract-generate')).toHaveLength(
      1,
    );
  });

  it('maps the active contract and skips timesheet placeholders when there is no invoice', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 0,
              limitCents: 84_000,
              remainingCents: 84_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [
        makeContract({
          id: 'c-active',
          contractStatus: ContractStatus.Active,
        }),
      ],
      invoices: [],
      year: 2026,
      locale: 'de',
      dateRange: { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.some((d) => d.status === 'contract-active')).toBe(true);
    expect(docs.some((d) => d.status === 'timesheet-generate')).toBe(false);
  });

  it('maps existing invoices and skips generate for that month', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 12_000,
              limitCents: 84_000,
              remainingCents: 72_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [
        makeContract({
          id: 'c-active',
          contractStatus: ContractStatus.Active,
        }),
      ],
      invoices: [makeInvoice({ invoiceStatus: InvoiceStatus.Ready })],
      year: 2026,
      locale: 'de',
      dateRange: { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) },
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.filter((d) => d.status === 'timesheet-ready')).toHaveLength(1);
    expect(docs.filter((d) => d.status === 'timesheet-generate')).toHaveLength(
      0,
    );
  });

  // VOLI-1283: a timesheet the volunteer signed (awaiting the supervisor's
  // countersignature) must surface in the admin board's Sign-timesheets stage
  // — even when its period is NOT the current month (All-time view).
  it('surfaces an awaiting-countersignature invoice on All-time regardless of its period month', () => {
    const year = new Date().getFullYear();
    // A month in the current year that is guaranteed to differ from the
    // current month, so the All-time view (no range) must still pick it up.
    const invoiceMonth = (new Date().getMonth() + 6) % 12;
    const periodStart = new Date(year, invoiceMonth, 1);

    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 12_000,
              limitCents: 84_000,
              remainingCents: 72_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [
        makeContract({
          id: 'c-active',
          contractStatus: ContractStatus.Active,
          periodStart: new Date(year, 0, 1).toISOString(),
          periodEnd: new Date(year, 11, 31).toISOString(),
        }),
      ],
      invoices: [
        makeInvoice({
          id: 'i-signed',
          invoiceStatus: InvoiceStatus.AwaitingSupervisorSignature,
          periodStart: periodStart.toISOString(),
          periodEnd: new Date(year, invoiceMonth + 1, 0).toISOString(),
        }),
      ],
      year,
      locale: 'de',
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.some((d) => d.status === 'timesheet-signing-super')).toBe(true);
  });

  // VOLI-1283: an existing timesheet is a real document in the workflow and
  // must never be orphaned out of every stage — even when the volunteer has no
  // currently-active contract (e.g. it is still being countersigned).
  it('surfaces an awaiting-countersignature invoice even when no contract is active', () => {
    const year = new Date().getFullYear();
    const invoicesDuring = {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31),
    };

    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 21_300,
              limitCents: 84_000,
              remainingCents: 62_700,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      // No ACTIVE contract: only an uncountersigned Vereinbarung exists.
      contracts: [
        makeContract({
          id: 'c-pending',
          contractStatus: ContractStatus.AwaitingNgoSignature,
          periodStart: new Date(year, 0, 1).toISOString(),
          periodEnd: new Date(year, 11, 31).toISOString(),
        }),
      ],
      invoices: [
        makeInvoice({
          id: 'i-signed',
          invoiceStatus: InvoiceStatus.AwaitingSupervisorSignature,
          periodStart: new Date(year, new Date().getMonth(), 1).toISOString(),
          periodEnd: new Date(year, new Date().getMonth() + 1, 0).toISOString(),
        }),
      ],
      year,
      locale: 'de',
      dateRange: invoicesDuring,
    });
    const docs = volunteers[0]?.documents ?? [];
    expect(docs.some((d) => d.status === 'timesheet-signing-super')).toBe(true);
  });

  // VOLI-1283: the documents-creation flow ("Not created yet") keys a
  // document line off the volunteer's documents — an awaiting-countersignature
  // invoice must count as already created, not as a fresh create prompt.
  it('flags a timesheet as over-cap regardless of its status', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 90_000,
              limitCents: 100_000,
              remainingCents: 10_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [],
      invoices: [
        makeInvoice({
          id: 'i-over',
          totalAmountCents: 20_000,
          invoiceStatus: InvoiceStatus.AwaitingVolunteerSignature,
        }),
      ],
      year: 2026,
      locale: 'de',
    });
    const doc = volunteers[0]?.documents.find(
      (d) => d.status === 'timesheet-signing-vol',
    );
    expect(doc?.isOverCap).toBe(true);
  });

  it('does not flag a timesheet when used plus amount stays within the cap', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 90_000,
              limitCents: 100_000,
              remainingCents: 10_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [],
      invoices: [
        makeInvoice({
          id: 'i-under',
          totalAmountCents: 5_000,
          invoiceStatus: InvoiceStatus.Ready,
        }),
      ],
      year: 2026,
      locale: 'de',
    });
    const doc = volunteers[0]?.documents.find(
      (d) => d.status === 'timesheet-ready',
    );
    expect(doc?.isOverCap).toBe(false);
  });

  it('ignores declined invoices for the cap check', () => {
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Anna Müller', image: null },
          usageByType: [
            {
              usedCents: 90_000,
              limitCents: 100_000,
              remainingCents: 10_000,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [],
      invoices: [
        makeInvoice({
          id: 'i-declined',
          totalAmountCents: 20_000,
          invoiceStatus: InvoiceStatus.Declined,
        }),
      ],
      year: 2026,
      locale: 'de',
    });
    const doc = volunteers[0]?.documents.find(
      (d) => d.status === 'timesheet-declined',
    );
    expect(doc?.isOverCap).toBeUndefined();
  });

  it('counts an awaiting-countersignature invoice as created in the documents-creation summary', () => {
    const year = new Date().getFullYear();
    const volunteers = buildBoardVolunteers({
      rosterUsage: [
        {
          volunteer: { id: 'v-1', name: 'Stefano Cerelli', image: null },
          usageByType: [
            {
              usedCents: 21_300,
              limitCents: 84_000,
              remainingCents: 62_700,
              reimbursementType: ehrenamtType,
            },
          ],
        },
      ],
      contracts: [
        makeContract({
          id: 'c-active',
          contractStatus: ContractStatus.Active,
          periodStart: new Date(year, 0, 1).toISOString(),
          periodEnd: new Date(year, 11, 31).toISOString(),
        }),
      ],
      invoices: [
        makeInvoice({
          id: 'i-signed',
          invoiceStatus: InvoiceStatus.AwaitingSupervisorSignature,
          periodStart: new Date(year, new Date().getMonth(), 1).toISOString(),
          periodEnd: new Date(year, new Date().getMonth() + 1, 0).toISOString(),
        }),
      ],
      year,
      locale: 'de',
      dateRange: { from: new Date(year, 0, 1), to: new Date(year, 11, 31) },
    });

    const vol = volunteers[0];
    if (!vol) throw new Error('expected a built volunteer');
    const summary = getDocLineSummary(vol, 'invoice', 'ehrenamt');
    expect(summary.count).toBeGreaterThan(0);
    expect(summary.latest?.status).toBe('timesheet-signing-super');
  });
});

describe('boardYear', () => {
  it('uses from year, then to year, then current year', () => {
    expect(boardYear({ from: new Date(2025, 0, 1) })).toBe(2025);
    expect(boardYear({ to: new Date(2024, 0, 1) })).toBe(2024);
    expect(boardYear(undefined)).toBe(new Date().getFullYear());
  });
});

function makeVol(documents: BoardDocument[] = []): BoardVolunteer {
  return {
    id: 'v-1',
    name: 'Anna Müller',
    initials: 'AM',
    pauschale: 'ehrenamt',
    usedAmount: 0,
    totalCap: 840,
    documents,
  };
}

describe('getContractStateForPicker', () => {
  it('returns none when the volunteer has no contract for the pauschale', () => {
    const vol = makeVol([]);
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('none');
    expect(getContractStateForPicker(vol, 'uebungsleiter')).toBe('none');
  });

  it('returns active for a fully-signed contract', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-active',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('active');
    expect(getContractStateForPicker(vol, 'uebungsleiter')).toBe('none');
  });

  it('returns declined for a declined contract', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-declined',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('declined');
  });

  it('returns expired for a contract whose period has ended', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-expired',
        periodLabel: 'August 2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('expired');
  });

  it('returns awaiting-countersignature for a coordinator-signed contract', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-signing-coord',
        periodLabel: '2026',
        pauschale: 'uebungsleiter',
      },
    ]);
    expect(getContractStateForPicker(vol, 'uebungsleiter')).toBe(
      'awaiting-countersignature',
    );
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('none');
  });

  it('returns awaiting-signature for created-but-not-signed contracts', () => {
    const draft = makeVol([
      {
        id: 'c-1',
        status: 'contract-draft',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(draft, 'ehrenamt')).toBe(
      'awaiting-signature',
    );

    const signingVol = makeVol([
      {
        id: 'c-2',
        status: 'contract-signing-vol',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(signingVol, 'ehrenamt')).toBe(
      'awaiting-signature',
    );
  });

  it('treats synthesized placeholders as none', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-generate',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
      {
        id: 'c-2',
        status: 'contract-missing',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getContractStateForPicker(vol, 'ehrenamt')).toBe('none');
  });
});

describe('getLatestTimesheetPeriod', () => {
  it('returns undefined when there are no timesheets', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-active',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBeUndefined();
  });

  it('returns the covered period of the most recent timesheet across pauschales', () => {
    const vol = makeVol([
      {
        id: 'i-1',
        status: 'timesheet-ready',
        periodLabel: 'July 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        id: 'i-2',
        status: 'timesheet-ready',
        periodLabel: 'June 2026',
        pauschale: 'uebungsleiter',
        periodStart: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBe('July 2026');
  });

  it('ignores a declined timesheet even when its period is newer', () => {
    const vol = makeVol([
      {
        id: 'i-1',
        status: 'timesheet-ready',
        periodLabel: 'July 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        id: 'i-2',
        status: 'timesheet-declined',
        periodLabel: 'August 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBe('July 2026');
  });

  it('returns undefined when the only timesheet has not been created yet', () => {
    const vol = makeVol([
      {
        id: 'i-1',
        status: 'timesheet-generate',
        periodLabel: 'September 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBeUndefined();
  });

  it('shows the older issued period, not a newer to-create row, when both exist', () => {
    const vol = makeVol([
      {
        id: 'i-1',
        status: 'timesheet-ready',
        periodLabel: 'July 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        id: 'i-2',
        status: 'timesheet-generate',
        periodLabel: 'September 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBe('July 2026');
  });

  it('counts a timesheet that is still in signing as issued', () => {
    const vol = makeVol([
      {
        id: 'i-1',
        status: 'timesheet-signing-vol',
        periodLabel: 'August 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    expect(getLatestTimesheetPeriod(vol)).toBe('August 2026');
  });
});

describe('getPickerAnnotations', () => {
  it('returns annotations for both pauschales and the latest timesheet period', () => {
    const vol = makeVol([
      {
        id: 'c-1',
        status: 'contract-active',
        periodLabel: '2026',
        pauschale: 'ehrenamt',
      },
      {
        id: 'i-1',
        status: 'timesheet-ready',
        periodLabel: 'July 2026',
        pauschale: 'ehrenamt',
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    const annotations = getPickerAnnotations(vol);
    expect(annotations.contracts).toHaveLength(2);
    expect(
      annotations.contracts.find((c) => c.pauschale === 'ehrenamt')?.state,
    ).toBe('active');
    expect(
      annotations.contracts.find((c) => c.pauschale === 'uebungsleiter')?.state,
    ).toBe('none');
    expect(annotations.latestTimesheetPeriod).toBe('July 2026');
  });

  it('leaves latestTimesheetPeriod undefined when there is no timesheet', () => {
    expect(
      getPickerAnnotations(makeVol([])).latestTimesheetPeriod,
    ).toBeUndefined();
  });
});

describe('documentRowAction', () => {
  const doc = (status: DocStatus): BoardDocument => ({
    id: 'synthetic-or-real',
    status,
    periodLabel: '',
  });

  it('routes a timesheet still to create to the creation modal, not the detail sheet', () => {
    expect(documentRowAction(doc('timesheet-generate'))).toBe('create');
  });

  it('makes a contract still to create inert on the row body', () => {
    expect(documentRowAction(doc('contract-generate'))).toBe('none');
  });

  it('makes an auto-drafted contract inert on the row body', () => {
    expect(documentRowAction(doc('contract-draft'))).toBe('none');
  });

  it('opens the detail sheet for rows backed by a persisted document', () => {
    const persisted: DocStatus[] = [
      'contract-signing-vol',
      'contract-signing-coord',
      'contract-active',
      'contract-missing',
      'contract-declined',
      'timesheet-signing-vol',
      'timesheet-signing-super',
      'timesheet-ready',
      'timesheet-muted',
      'timesheet-declined',
    ];
    for (const status of persisted) {
      expect(documentRowAction(doc(status))).toBe('open');
    }
  });
});

describe('creationTargetFor', () => {
  it('opens the contract modal for every contract row still to create', () => {
    const statuses: DocStatus[] = [
      'contract-generate',
      'contract-draft',
      'contract-declined',
      'contract-missing',
    ];
    for (const status of statuses) {
      expect(creationTargetFor(status)).toBe('contract');
    }
  });

  it('opens the invoice modal for every timesheet row still to create', () => {
    const statuses: DocStatus[] = ['timesheet-generate', 'timesheet-declined'];
    for (const status of statuses) {
      expect(creationTargetFor(status)).toBe('invoice');
    }
  });

  it('has nothing to create once a document is in its signing chain', () => {
    const statuses: DocStatus[] = [
      'contract-signing-vol',
      'contract-signing-coord',
      'contract-active',
      'timesheet-signing-vol',
      'timesheet-signing-super',
      'timesheet-ready',
      'timesheet-muted',
    ];
    for (const status of statuses) {
      expect(creationTargetFor(status)).toBeNull();
    }
  });

  it('backs every row that shows a Preview and create button', () => {
    for (const [status, meta] of Object.entries(STATUS_META)) {
      if (meta.actionKey !== 'create') continue;
      expect(creationTargetFor(status as DocStatus)).not.toBeNull();
    }
  });
});

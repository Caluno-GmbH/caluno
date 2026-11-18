/**
 * Accounting content for the Altonaer Lesepaten demo: configured templates,
 * signed agreements and timesheets, delivery settings and a short delivery
 * history, so the reimbursements board, the bundle send flow (VOLI-1766) and
 * the delivery log can be shown right after `bun bootstrap`.
 *
 * Seeded by `demo-fixtures.ts` only, never by `demo-fixtures-into-org.ts`:
 * templates and delivery settings would change how a real organization works.
 * Like the rest of the demo it runs on every deploy, so every write is
 * skipped when its row already exists: templates and settings an admin has
 * changed, and documents already signed, sent or paid, stay as they are.
 */
import { eq } from 'drizzle-orm';
import {
  BundleDeliveryMethod,
  ContractStatus,
  DocumentKind,
  InvoiceStatus,
  ReimbursementTypeKey,
  SigneeType,
} from '../accounting/enums';
import { PERMISSIONS } from '../auth/constants';
import { EmailDeliveryStatus } from '../notification/email/outbox/email-outbox.enums';
import { TimeEntryClosureKind } from '../time-tracking/enums/time-entry-closure-kind.enum';
import { DEMO_TEMPLATE_BODIES } from './demo-document-templates';
import type { DemoOrganizationHandles } from './demo-organization';
import {
  addHours,
  type Database,
  fixtureId,
  fixtureUserId,
  fixtureWallClockToUtc,
  getDateInFixtureTimezone,
} from './fixture-helpers';
import * as schema from './schema';

/** Plus-addressed onto the demo group, so sends land in the demo inbox. */
const ACCOUNTING_EMAIL = 'demo+buchhaltung@caluno.org';

const TEMPLATE_PAUSCHALEN = [
  { key: ReimbursementTypeKey.EHRENAMT, preset: 'ehrenamt' },
  { key: ReimbursementTypeKey.UEBUNGSLEITER, preset: 'uebungsleiter' },
] as const;

/** The manual fields the contract builder requires before it saves. */
const CONTRACT_MANUAL_VALUES = (year: number): Record<string, string> => ({
  tasks: 'Vorlesen und Leseförderung für Kinder in Kitas und Bibliotheken',
  'contract-lifespan': String(year),
  'hours-amount': '10',
});

type MonthRef = { year: number; month: number };

interface DemoAccountingInput {
  org: DemoOrganizationHandles;
  coordinatorId: string;
  memberEmail: (index: number) => string;
}

export async function seedDemoAccounting(
  db: Database,
  { org, coordinatorId, memberEmail }: DemoAccountingInput,
): Promise<void> {
  const [types, accountingManage] = await Promise.all([
    db.query.reimbursementTypes.findMany(),
    db.query.permissions.findFirst({
      where: { key: PERMISSIONS.ACCOUNTING_MANAGE },
    }),
  ]);
  const ehrenamt = types.find((t) => t.key === ReimbursementTypeKey.EHRENAMT);
  if (!ehrenamt || !accountingManage) {
    console.warn(
      'Reimbursement types or permissions missing — run `bun run db:seed` first. Skipping demo accounting.',
    );
    return;
  }

  const today = getDateInFixtureTimezone(new Date());

  // ─── Vorlagen: alle vier Slots organisationsweit, aus den Builder-Presets ───
  const templates = new Map<
    string,
    typeof schema.documentTemplates.$inferSelect
  >();
  for (const pauschale of TEMPLATE_PAUSCHALEN) {
    const type = types.find((t) => t.key === pauschale.key);
    if (!type) continue;
    for (const kind of [DocumentKind.CONTRACT, DocumentKind.INVOICE]) {
      const body = structuredClone(
        DEMO_TEMPLATE_BODIES[
          kind === DocumentKind.CONTRACT ? 'contract' : 'invoice'
        ][pauschale.preset],
      );
      if (kind === DocumentKind.CONTRACT) {
        fillManualFields(body, CONTRACT_MANUAL_VALUES(today.year));
      }
      const template = await ensureTemplate(db, {
        organizationId: org.organizationId,
        reimbursementTypeKey: type.key,
        kind,
        body,
        editorId: coordinatorId,
        accountingManagePermissionId: accountingManage.id,
      });
      templates.set(`${pauschale.key}:${kind}`, template);
    }
  }
  const contractTemplate = templates.get(
    `${ReimbursementTypeKey.EHRENAMT}:${DocumentKind.CONTRACT}`,
  );
  const invoiceTemplate = templates.get(
    `${ReimbursementTypeKey.EHRENAMT}:${DocumentKind.INVOICE}`,
  );
  if (!contractTemplate || !invoiceTemplate) return;

  // ─── Versand an die Buchhaltung: Verein per E-Mail, Süd lädt herunter
  // (eigene Einstellung), West übernimmt Adresse und Versandart, mit eigenem
  // Betreff ───
  const deliverySettings = [
    {
      organizationUnitId: org.rootUnitId,
      deliveryMethod: BundleDeliveryMethod.EMAIL,
      recipientEmail: ACCOUNTING_EMAIL,
    },
    {
      organizationUnitId: org.unitIds.sued,
      deliveryMethod: BundleDeliveryMethod.DOWNLOAD,
    },
    {
      organizationUnitId: org.unitIds.west,
      emailSubject: 'Lesepaten West: {volunteer} – {period}',
    },
  ];
  for (const setting of deliverySettings) {
    await db
      .insert(schema.accountingDeliverySettings)
      .values({
        organizationId: org.organizationId,
        updatedByUserId: coordinatorId,
        ...setting,
      })
      .onConflictDoNothing({
        target: schema.accountingDeliverySettings.organizationUnitId,
      });
  }

  // ─── Fertige Pakete in Lesepaten Nord: je eines pro Prüffall beim Senden ───
  const unitId = org.unitIds.nord;
  const month = (monthsBack: number): MonthRef => {
    const index = today.year * 12 + (today.month - 1) - monthsBack;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  };
  const contractPeriod = {
    start: monthStart(month(6)),
    end: fixtureWallClockToUtc(today.year + 1, 1, 1, 0),
  };
  const volunteer = async (index: number) => {
    const user = await db.query.users.findFirst({
      where: { id: fixtureUserId(memberEmail(index)) },
      columns: { id: true, name: true },
    });
    return user ?? null;
  };

  const documents = {
    db,
    unitId,
    coordinatorId,
    reimbursementTypeKey: ehrenamt.key,
    hourlyRateCents: ehrenamt.platformDefaultRateCents,
    contractTemplate,
    invoiceTemplate,
    accountingManagePermissionId: accountingManage.id,
  };

  // Sauber: aktive Vereinbarung, zwei Stundennachweise.
  const clean = await volunteer(20);
  if (clean) {
    await ensureActiveContract(documents, 'clean', clean.id, contractPeriod);
    await ensureReadyTimesheet(documents, 'clean-1', clean.id, month(2), 6);
    await ensureReadyTimesheet(documents, 'clean-2', clean.id, month(1), 4);
  }

  // Stunden ohne aktive Vereinbarung.
  const noContract = await volunteer(21);
  if (noContract) {
    await ensureReadyTimesheet(
      documents,
      'no-contract',
      noContract.id,
      month(1),
      6,
    );
  }

  // Jahresfreibetrag überschritten: manueller Ausgangswert in Höhe des
  // Freibetrags, der Stundennachweis kommt obendrauf.
  const overLimit = await volunteer(22);
  if (overLimit) {
    await ensureActiveContract(
      documents,
      'over-limit',
      overLimit.id,
      contractPeriod,
    );
    const timesheetMonth = month(1);
    await ensureReadyTimesheet(
      documents,
      'over-limit',
      overLimit.id,
      timesheetMonth,
      4,
    );
    await db
      .insert(schema.reimbursementManualBaselines)
      .values({
        organizationId: org.organizationId,
        volunteerId: overLimit.id,
        reimbursementTypeKey: ehrenamt.key,
        year: timesheetMonth.year,
        amountCents: ehrenamt.yearlyLimitCents,
        updatedByUserId: coordinatorId,
      })
      .onConflictDoNothing();
  }

  // Schon an die Buchhaltung gesendet, und einmal heruntergeladen.
  const pastDeliveries = [
    {
      key: 'sent',
      index: 23,
      method: BundleDeliveryMethod.EMAIL,
      daysAgo: 3,
    },
    {
      key: 'downloaded',
      index: 24,
      method: BundleDeliveryMethod.DOWNLOAD,
      daysAgo: 6,
    },
  ];
  for (const delivery of pastDeliveries) {
    const member = await volunteer(delivery.index);
    if (!member) continue;
    await ensureActiveContract(
      documents,
      delivery.key,
      member.id,
      contractPeriod,
    );
    const timesheetMonth = month(2);
    const invoiceId = await ensureReadyTimesheet(
      documents,
      delivery.key,
      member.id,
      timesheetMonth,
      5,
    );
    const deliveryId = demoId(`delivery:${delivery.key}`);
    const existing = await db.query.reimbursementBundleDeliveries.findFirst({
      where: { id: deliveryId },
      columns: { id: true },
    });
    if (existing) continue;
    const occurredAt = new Date(Date.now() - delivery.daysAgo * 86_400_000);
    const isEmail = delivery.method === BundleDeliveryMethod.EMAIL;
    await db.transaction(async (tx) => {
      await tx.insert(schema.reimbursementBundleDeliveries).values({
        id: deliveryId,
        organizationUnitId: unitId,
        volunteerId: member.id,
        reimbursementTypeKey: ehrenamt.key,
        method: delivery.method,
        invoiceIds: [invoiceId],
        recipientEmail: isEmail ? ACCOUNTING_EMAIL : null,
        subject: isEmail
          ? `Abrechnung ${member.name} – ${monthLabel(timesheetMonth)} (Ehrenamtspauschale)`
          : null,
        emailStatus: isEmail ? EmailDeliveryStatus.SENT : null,
        deliveredByUserId: coordinatorId,
        occurredAt,
      });
      // Handing a bundle over marks its timesheets paid, as the app does.
      await tx
        .update(schema.invoices)
        .set({ paidAt: occurredAt, paidByUserId: coordinatorId })
        .where(eq(schema.invoices.id, invoiceId));
      if (!isEmail) {
        await tx
          .insert(schema.reimbursementBundleDownloads)
          .values({
            volunteerId: member.id,
            reimbursementTypeKey: ehrenamt.key,
            downloadedAt: occurredAt,
            downloadedByUserId: coordinatorId,
          })
          .onConflictDoNothing();
      }
    });
  }

  console.log(
    'Abrechnung: Vorlagen für beide Pauschalen; Versand per E-Mail an demo+buchhaltung@ (Süd: Herunterladen, West: eigener Betreff); Lesepaten Nord mit fünf fertigen Paketen — sauber, ohne Vereinbarung, über dem Freibetrag, bereits gesendet, bereits heruntergeladen.',
  );
}

// ─── Helpers ───

/** Deterministic ids, so a re-run finds what the first run created. */
const demoId = (key: string) => fixtureId(`demo-accounting:${key}`);

const monthStart = ({ year, month }: MonthRef) =>
  fixtureWallClockToUtc(year, month, 1, 0);

const nextMonthStart = ({ year, month }: MonthRef) =>
  month === 12
    ? fixtureWallClockToUtc(year + 1, 1, 1, 0)
    : fixtureWallClockToUtc(year, month + 1, 1, 0);

const monthLabel = (ref: MonthRef) =>
  new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(monthStart(ref));

function fillManualFields(node: unknown, values: Record<string, string>): void {
  if (Array.isArray(node)) {
    for (const child of node) fillManualFields(child, values);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const value = record.value as { kind?: string; value?: string } | undefined;
  if (
    typeof record.id === 'string' &&
    record.id in values &&
    value?.kind === 'manual-template'
  ) {
    value.value = values[record.id];
  }
  for (const child of Object.values(record)) fillManualFields(child, values);
}

async function ensureTemplate(
  db: Database,
  args: {
    organizationId: string;
    reimbursementTypeKey: ReimbursementTypeKey;
    kind: DocumentKind;
    body: typeof schema.documentTemplates.$inferInsert.body;
    editorId: string;
    accountingManagePermissionId: string;
  },
) {
  const existing = await db.query.documentTemplates.findFirst({
    where: {
      organizationId: args.organizationId,
      reimbursementTypeKey: args.reimbursementTypeKey,
      kind: args.kind,
      organizationUnitId: { isNull: true },
      isDeleted: false,
    },
  });
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [template] = await tx
      .insert(schema.documentTemplates)
      .values({
        organizationId: args.organizationId,
        reimbursementTypeKey: args.reimbursementTypeKey,
        kind: args.kind,
        body: args.body,
        lastEditedAt: new Date(),
        lastEditedBy: args.editorId,
      })
      .returning();
    if (!template) throw new Error(`Failed to create ${args.kind} template`);
    // The chain a new template gets in the builder: volunteer, then a holder
    // of accounting:manage countersigns.
    await tx.insert(schema.templateSignees).values([
      {
        documentTemplateId: template.id,
        order: 0,
        signeeType: SigneeType.VOLUNTEER,
      },
      {
        documentTemplateId: template.id,
        order: 1,
        signeeType: SigneeType.PERMISSION_HOLDER,
        requiredPermissionId: args.accountingManagePermissionId,
      },
    ]);
    return template;
  });
}

interface DocumentContext {
  db: Database;
  unitId: string;
  coordinatorId: string;
  reimbursementTypeKey: ReimbursementTypeKey;
  hourlyRateCents: number;
  contractTemplate: typeof schema.documentTemplates.$inferSelect;
  invoiceTemplate: typeof schema.documentTemplates.$inferSelect;
  accountingManagePermissionId: string;
}

const signatures = (ctx: DocumentContext, volunteerId: string, from: Date) => [
  {
    order: 0,
    signeeType: SigneeType.VOLUNTEER,
    signedByUserId: volunteerId,
    signedAt: addHours(from, 2 * 24 + 18.5),
  },
  {
    order: 1,
    signeeType: SigneeType.PERMISSION_HOLDER,
    requiredPermissionId: ctx.accountingManagePermissionId,
    signedByUserId: ctx.coordinatorId,
    signedAt: addHours(from, 3 * 24 + 9.25),
  },
];

async function ensureActiveContract(
  ctx: DocumentContext,
  key: string,
  volunteerId: string,
  period: { start: Date; end: Date },
): Promise<void> {
  const id = demoId(`contract:${key}`);
  const existing = await ctx.db.query.contracts.findFirst({
    where: { id },
    columns: { id: true },
  });
  if (existing) return;

  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.contracts).values({
      id,
      documentTemplateId: ctx.contractTemplate.id,
      volunteerId,
      reimbursementTypeKey: ctx.reimbursementTypeKey,
      organizationUnitId: ctx.unitId,
      contractStatus: ContractStatus.ACTIVE,
      periodStart: period.start,
      periodEnd: period.end,
      resolvedBody: structuredClone(ctx.contractTemplate.body),
    });
    await tx.insert(schema.contractSignatures).values(
      signatures(ctx, volunteerId, period.start).map((signature) => ({
        contractId: id,
        ...signature,
      })),
    );
  });
}

/**
 * A READY timesheet claiming its own closed time entries. Its PDF is rendered
 * from live data the first time it is downloaded or sent, as for any READY
 * timesheet whose rendering never ran.
 */
async function ensureReadyTimesheet(
  ctx: DocumentContext,
  key: string,
  volunteerId: string,
  month: MonthRef,
  hours: number,
): Promise<string> {
  const id = demoId(`timesheet:${key}`);
  const existing = await ctx.db.query.invoices.findFirst({
    where: { id },
    columns: { id: true },
  });
  if (existing) return id;

  const entries = [5, 12].map((day, index) => {
    const startedAt = fixtureWallClockToUtc(month.year, month.month, day, 9);
    const share = index === 0 ? Math.ceil(hours / 2) : Math.floor(hours / 2);
    return {
      id: demoId(`time-entry:${key}:${index}`),
      organizationUnitId: ctx.unitId,
      volunteerId,
      reimbursementTypeKey: ctx.reimbursementTypeKey,
      createdById: ctx.coordinatorId,
      startedAt,
      endedAt: addHours(startedAt, share),
      closureKind: TimeEntryClosureKind.MANUAL,
      notes: 'Vorlesestunde — für die Abrechnungs-Demo erfasst',
    };
  });
  const periodStart = monthStart(month);

  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.timeEntries).values(entries);
    await tx.insert(schema.invoices).values({
      id,
      documentTemplateId: ctx.invoiceTemplate.id,
      volunteerId,
      reimbursementTypeKey: ctx.reimbursementTypeKey,
      organizationUnitId: ctx.unitId,
      invoiceStatus: InvoiceStatus.READY,
      periodStart,
      periodEnd: nextMonthStart(month),
      totalHours: hours,
      hourlyRateCents: ctx.hourlyRateCents,
      totalAmountCents: hours * ctx.hourlyRateCents,
      resolvedBody: structuredClone(ctx.invoiceTemplate.body),
      // Outside the app's numbering: the prefix cannot collide with a number
      // an admin's timesheet draws, and seq 0 does not advance the counter.
      documentNumber: `DEMO-${key}`,
      documentNumberSeq: 0,
      documentNumberYear: month.year,
      documentNumberScopeUnitId: ctx.unitId,
    });
    await tx
      .insert(schema.invoiceTimeEntries)
      .values(
        entries.map((entry) => ({ invoiceId: id, timeEntryId: entry.id })),
      );
    await tx
      .insert(schema.invoiceSignatures)
      .values(
        signatures(ctx, volunteerId, nextMonthStart(month)).map(
          (signature) => ({ invoiceId: id, ...signature }),
        ),
      );
  });
  return id;
}

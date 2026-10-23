import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
  ne,
} from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
  NotFoundGraphQLError,
} from '../../graphql/errors';
import { OrganizationService } from '../../organization/organization.service';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../../shared/observability/posthog.events';
import { PostHogService } from '../../shared/observability/posthog.service';
import { ShiftInviteStatus } from '../../shift/enums';
import { appDateParts } from '../../shift/utils/app-time';
import type { TimeEntryEntity } from '../../time-tracking/schemas/time-entry.schema';
import type {
  EligibleTimesheetVolunteer,
  InvoiceFilter,
  InvoiceWithRelations,
  PendingSignee,
} from '../accounting.types';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  InvoiceStatus,
  SigneeType,
} from '../enums';
import type { CreateInvoiceInput } from '../inputs/create-invoice.input';
import { toFieldOverridesMap } from '../inputs/document-field-override.input';
import type { InvoiceEntity } from '../schemas/invoice.schema';
import type { InvoiceStatusChangeEntity } from '../schemas/invoice-status-change.schema';
import {
  billingMonthBoundsOf,
  billingYearBounds,
  periodCovers,
} from '../utils/billing-period';
import {
  ContractCover,
  type CoverageTarget,
  coverageTargetsForTimeEntries,
  entriesWithoutCover,
} from '../utils/contract-coverage';
import { formatInvoiceNumber } from '../utils/invoice-number';
import { groupTimesheetCandidates } from '../utils/timesheet-groups';
import { ContractService } from './contract.service';
import { DocumentNotificationService } from './document-notification.service';
import { DocumentProfileRequirementService } from './document-profile-requirement.service';
import { DocumentRenderingService } from './document-rendering.service';
import { DocumentSigningService } from './document-signing.service';
import { DocumentTemplateService } from './document-template.service';
import {
  findManualFieldValue,
  type TemplateBodyShape,
} from './document-template.types';
import { ReimbursementRateService } from './reimbursement-rate.service';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly documentTemplateService: DocumentTemplateService,
    private readonly documentSigningService: DocumentSigningService,
    private readonly reimbursementRateService: ReimbursementRateService,
    private readonly contractService: ContractService,
    private readonly documentNotificationService: DocumentNotificationService,
    private readonly documentProfileRequirementService: DocumentProfileRequirementService,
    private readonly documentRenderingService: DocumentRenderingService,
    private readonly organizationService: OrganizationService,
    private readonly postHogService: PostHogService,
  ) {}

  async findInvoice(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.db.query.invoices.findFirst({
      where: { id },
      with: {
        documentTemplate: true,
        reimbursementType: true,
        signatures: { orderBy: { order: 'asc' } },
        // Postgres sorts an enum by declaration order, which is lifecycle
        // order, so `type` breaks the tie between rows of one transaction.
        statusChanges: { orderBy: { occurredAt: 'asc', type: 'asc' } },
        invoiceTimeEntries: true,
        organizationUnit: true,
      },
    });
    if (!invoice) {
      throw new NotFoundGraphQLError(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  /**
   * The id of the invoice's PDF, rendering it first when it has none. The PDF
   * is rendered once the invoice is fully signed, but a failure there does not
   * undo the signing, so a READY invoice can be left without one; it is then
   * rendered when it is needed. Null when rendering fails again.
   */
  async ensurePdf(
    invoiceId: string,
    actorUserId: string,
  ): Promise<string | null> {
    const invoice = await this.findInvoice(invoiceId);
    if (invoice.fileId) return invoice.fileId;
    return this.documentRenderingService.renderAndAttachPdf(
      invoice,
      actorUserId,
    );
  }

  async findInvoicesForOrganization(
    organizationId: string,
    filter: InvoiceFilter = {},
  ): Promise<InvoiceEntity[]> {
    const conditions = [
      eq(schema.documentTemplates.organizationId, organizationId),
    ];
    if (filter.volunteerId) {
      conditions.push(eq(schema.invoices.volunteerId, filter.volunteerId));
    }
    if (filter.reimbursementTypeId) {
      conditions.push(
        eq(schema.invoices.reimbursementTypeId, filter.reimbursementTypeId),
      );
    }
    if (filter.status) {
      conditions.push(eq(schema.invoices.invoiceStatus, filter.status));
    }
    if (filter.issuedOnly) {
      conditions.push(ne(schema.invoices.invoiceStatus, InvoiceStatus.DRAFT));
    }
    // Periods end exclusively, so one ending exactly at the range start
    // doesn't overlap it.
    if (filter.periodStart) {
      conditions.push(gt(schema.invoices.periodEnd, filter.periodStart));
    }
    if (filter.periodEnd) {
      conditions.push(lt(schema.invoices.periodStart, filter.periodEnd));
    }
    if (filter.organizationUnitId) {
      conditions.push(
        eq(schema.invoices.organizationUnitId, filter.organizationUnitId),
      );
    }

    const rows = await this.db
      .select({ invoice: schema.invoices })
      .from(schema.invoices)
      .innerJoin(
        schema.documentTemplates,
        eq(schema.documentTemplates.id, schema.invoices.documentTemplateId),
      )
      .where(and(...conditions));

    return rows.map((row) => row.invoice);
  }

  async findEligibleTimeEntries(
    volunteerId: string,
    reimbursementTypeId: string,
    organizationUnitId: string,
    periodStart?: Date,
    periodEnd?: Date,
  ): Promise<TimeEntryEntity[]> {
    const conditions = [
      eq(schema.timeEntries.volunteerId, volunteerId),
      eq(schema.timeEntries.reimbursementTypeId, reimbursementTypeId),
      // A timesheet is issued in one unit; hours from a sibling unit must
      // never appear on it (or be claimable into it).
      eq(schema.timeEntries.organizationUnitId, organizationUnitId),
      isNotNull(schema.timeEntries.endedAt),
      // Time entries stay claimed while tied to a live (non-declined)
      // invoice. Declining releases the claim (see declineInvoice), so a
      // released row no longer excludes the entry here.
      isNull(schema.invoiceTimeEntries.id),
    ];
    if (periodStart) {
      conditions.push(gte(schema.timeEntries.startedAt, periodStart));
    }
    if (periodEnd) {
      conditions.push(lt(schema.timeEntries.startedAt, periodEnd));
    }

    const rows = await this.db
      .select({ timeEntry: schema.timeEntries })
      .from(schema.timeEntries)
      .leftJoin(
        schema.invoiceTimeEntries,
        and(
          eq(schema.invoiceTimeEntries.timeEntryId, schema.timeEntries.id),
          eq(schema.invoiceTimeEntries.released, false),
        ),
      )
      .where(and(...conditions));

    return rows.map((row) => row.timeEntry);
  }

  /**
   * Timesheets still to be created in the unit: eligible (unclaimed,
   * completed, in-period) hours grouped by volunteer, reimbursement type and
   * Berlin calendar month, with the month's bounds and summed hours. Entries
   * are only claimed once a timesheet is issued, so these rows always reflect
   * the current time entries. Each row also says whether any of its hours has
   * no non-declined contract and where the first such hour starts (VOLI-1587).
   */
  async findVolunteersNeedingTimesheets(
    organizationUnitId: string,
    periodStart?: Date,
    periodEnd?: Date,
  ): Promise<EligibleTimesheetVolunteer[]> {
    const conditions = [
      eq(schema.timeEntries.organizationUnitId, organizationUnitId),
      isNotNull(schema.timeEntries.endedAt),
      isNotNull(schema.timeEntries.reimbursementTypeId),
      isNull(schema.invoiceTimeEntries.id),
    ];
    if (periodStart) {
      conditions.push(gte(schema.timeEntries.startedAt, periodStart));
    }
    if (periodEnd) {
      conditions.push(lt(schema.timeEntries.startedAt, periodEnd));
    }

    const rows = await this.db
      .select({ timeEntry: schema.timeEntries })
      .from(schema.timeEntries)
      .leftJoin(
        schema.invoiceTimeEntries,
        and(
          eq(schema.invoiceTimeEntries.timeEntryId, schema.timeEntries.id),
          eq(schema.invoiceTimeEntries.released, false),
        ),
      )
      .where(and(...conditions));

    // The query already requires an end and a reimbursement type; the guard
    // is what lets the types say so.
    const entries = rows
      .map((row) => row.timeEntry)
      .filter(
        (
          entry,
        ): entry is typeof entry & {
          endedAt: Date;
          reimbursementTypeId: string;
        } => entry.endedAt !== null && entry.reimbursementTypeId !== null,
      );

    // One lookup for every entry of the result. "Cover" is any non-declined
    // contract: a draft or a contract awaiting signatures is already its own
    // task on the board, so it must not also raise a contract reminder (this
    // is broader than compliance, which counts ACTIVE only).
    const coverByEntry = await this.contractService.findCoveringContracts(
      coverageTargetsForTimeEntries(entries),
      ContractCover.OPEN,
    );
    const uncoveredIds = new Set(
      entriesWithoutCover(entries, coverByEntry).map((entry) => entry.id),
    );

    // An ACTIVE contract is what makes hours compliant. The same lookup lists
    // every non-declined contract per entry, so this needs no second query.
    const withoutActiveIds = new Set(
      entries
        .filter(
          (entry) =>
            !(coverByEntry.get(entry.id) ?? []).some(
              (contract) => contract.contractStatus === ContractStatus.ACTIVE,
            ),
        )
        .map((entry) => entry.id),
    );

    return groupTimesheetCandidates(entries, uncoveredIds, withoutActiveIds);
  }

  /**
   * Volunteers who signed up for (JOINED) a paid shift instance in the given
   * year but have no contract or invoice for that reimbursement type yet.
   * Unit-scoped: only shifts of `organizationUnitId` count, matching how the
   * reimbursement board and overview tasks scope contracts, invoices, and
   * timesheet candidates to the header org unit.
   *
   * "Paid" = the instance's effective reimbursement type is non-null
   * (`shiftInstances.overrideReimbursementTypeId ?? shifts.reimbursementTypeId`).
   * Returns one row per (volunteer, reimbursement type), excluding any pair
   * that already has a non-declined contract or an invoice in this unit
   * overlapping the requested year — those are already surfaced by the
   * contract/invoice maps.
   */
  async findPaidShiftSignupVolunteers(
    organizationUnitId: string,
    year: number,
  ): Promise<
    Array<{
      volunteerId: string;
      reimbursementTypeId: string;
      periodStart: Date;
      periodEnd: Date;
    }>
  > {
    const { start: yearStart, end: yearEnd } = billingYearBounds(year);

    const rows = await this.db
      .select({
        volunteerId: schema.shiftInstanceInvites.userId,
        overrideReimbursementTypeId:
          schema.shiftInstances.overrideReimbursementTypeId,
        shiftReimbursementTypeId: schema.shifts.reimbursementTypeId,
        actualStartsAt: schema.shiftInstances.actualStartsAt,
      })
      .from(schema.shiftInstanceInvites)
      .innerJoin(
        schema.shiftInstances,
        eq(schema.shiftInstances.id, schema.shiftInstanceInvites.instanceId),
      )
      .innerJoin(
        schema.shifts,
        eq(schema.shifts.id, schema.shiftInstances.masterId),
      )
      .where(
        and(
          eq(schema.shiftInstanceInvites.status, ShiftInviteStatus.JOINED),
          eq(schema.shiftInstances.isCancelled, false),
          eq(schema.shifts.organizationUnitId, organizationUnitId),
          gte(schema.shiftInstances.actualStartsAt, yearStart),
          lt(schema.shiftInstances.actualStartsAt, yearEnd),
        ),
      );

    const signups = new Map<
      string,
      {
        volunteerId: string;
        reimbursementTypeId: string;
        /** One instant per paid shift the volunteer joined. */
        dates: Date[];
      }
    >();
    for (const row of rows) {
      const reimbursementTypeId =
        row.overrideReimbursementTypeId ?? row.shiftReimbursementTypeId;
      if (!reimbursementTypeId) continue;
      const key = `${row.volunteerId}:${reimbursementTypeId}`;
      const entry = signups.get(key) ?? {
        volunteerId: row.volunteerId,
        reimbursementTypeId,
        dates: [],
      };
      if (row.actualStartsAt) entry.dates.push(row.actualStartsAt);
      signups.set(key, entry);
    }
    if (signups.size === 0) return [];

    const entries = [...signups.values()];
    const volunteerIds = [
      ...new Set(entries.map((entry) => entry.volunteerId)),
    ];
    const reimbursementTypeIds = [
      ...new Set(entries.map((entry) => entry.reimbursementTypeId)),
    ];

    const [contracts, invoices] = await Promise.all([
      this.db.query.contracts.findMany({
        where: {
          volunteerId: { in: volunteerIds },
          reimbursementTypeId: { in: reimbursementTypeIds },
          organizationUnitId,
          // An open (non-declined) contract is this pair's contract *task* —
          // create it if DRAFT, countersign it otherwise. That is distinct from
          // the ACTIVE-only "valid cover" predicate the payment checks use; the
          // board routes the task to Create or Countersign accordingly.
          contractStatus: { ne: ContractStatus.DECLINED },
          periodStart: { lt: yearEnd },
          periodEnd: { gt: yearStart },
        },
        columns: {
          volunteerId: true,
          reimbursementTypeId: true,
          periodStart: true,
          periodEnd: true,
        },
      }),
      this.db.query.invoices.findMany({
        where: {
          volunteerId: { in: volunteerIds },
          reimbursementTypeId: { in: reimbursementTypeIds },
          organizationUnitId,
          periodStart: { lt: yearEnd },
          periodEnd: { gt: yearStart },
        },
        columns: {
          volunteerId: true,
          reimbursementTypeId: true,
          periodStart: true,
          periodEnd: true,
        },
      }),
    ]);

    // A signup is covered only when a contract/invoice period actually contains
    // the shift's date — an OPEN contract for another month must not make a
    // later paid shift look covered (VOLI-1370).
    const isCovered = (
      entry: (typeof entries)[number],
      date: Date,
    ): boolean => {
      const contractsForPair = contracts.filter(
        (c) =>
          c.volunteerId === entry.volunteerId &&
          c.reimbursementTypeId === entry.reimbursementTypeId,
      );
      const invoicesForPair = invoices.filter(
        (i) =>
          i.volunteerId === entry.volunteerId &&
          i.reimbursementTypeId === entry.reimbursementTypeId,
      );
      return (
        contractsForPair.some((c) =>
          periodCovers(c.periodStart, c.periodEnd, date, date),
        ) ||
        invoicesForPair.some((i) =>
          periodCovers(i.periodStart, i.periodEnd, date, date),
        )
      );
    };

    return entries.flatMap((entry) => {
      const firstUncovered = entry.dates
        .filter((date) => !isCovered(entry, date))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!firstUncovered) return [];
      // The task is scoped to the uncovered month, so the board can say which
      // month has no valid contract instead of the whole year (VOLI-1370).
      const month = billingMonthBoundsOf(firstUncovered);
      return [
        {
          volunteerId: entry.volunteerId,
          reimbursementTypeId: entry.reimbursementTypeId,
          periodStart: month.start,
          periodEnd: month.end,
        },
      ];
    });
  }

  /**
   * The given invoices that have at least one claimed hour with no ACTIVE
   * contract right now, from one lookup for the whole list. This is the live
   * answer the board's "No active agreement" badge needs: the stored
   * `isNonCompliant` is only the state at creation and never follows a
   * contract being signed later.
   *
   * Hours are matched in the invoice's own volunteer and reimbursement type,
   * and in its unit (an org-wide invoice falls back to the claimed entry's
   * unit). Released claims are ignored. An invoice with no claimed hours is
   * not flagged.
   */
  async findInvoiceIdsWithoutActiveCover(
    invoiceIds: readonly string[],
  ): Promise<Set<string>> {
    if (invoiceIds.length === 0) return new Set();

    const invoices = await this.db.query.invoices.findMany({
      where: { id: { in: [...invoiceIds] } },
      with: {
        invoiceTimeEntries: {
          where: { released: false },
          with: { timeEntry: true },
        },
      },
    });

    const targets: CoverageTarget[] = [];
    const invoiceIdByKey = new Map<string, string>();
    for (const invoice of invoices) {
      for (const claim of invoice.invoiceTimeEntries) {
        const entry = claim.timeEntry;
        if (!entry) continue;
        const key = `${invoice.id}:${entry.id}`;
        invoiceIdByKey.set(key, invoice.id);
        targets.push({
          key,
          volunteerId: invoice.volunteerId,
          reimbursementTypeId: invoice.reimbursementTypeId,
          // The invoice's unit is the document's scope and wins. Eligibility
          // makes it equal to the entry's unit today (the root unit for an
          // org-wide invoice), so this does not depend on that rule holding.
          organizationUnitId:
            invoice.organizationUnitId ?? entry.organizationUnitId,
          at: entry.startedAt,
        });
      }
    }

    const cover = await this.contractService.findCoveringContracts(
      targets,
      ContractCover.ACTIVE,
    );
    const flagged = new Set<string>();
    for (const target of targets) {
      if ((cover.get(target.key) ?? []).length === 0) {
        const invoiceId = invoiceIdByKey.get(target.key);
        if (invoiceId) flagged.add(invoiceId);
      }
    }
    return flagged;
  }

  async createInvoice(
    organizationId: string,
    input: CreateInvoiceInput,
    actorUserId: string,
  ): Promise<InvoiceEntity> {
    if (input.timeEntryIds.length === 0) {
      throw new BadRequestGraphQLError(
        'At least one time entry must be selected',
      );
    }

    if (input.manualBaselineCents != null && input.manualBaselineCents < 0) {
      throw new BadRequestGraphQLError('Initial amount must not be negative');
    }

    // Only entries inside the invoice's own period can go on it, so the
    // document never lists hours from outside the period it states.
    //
    // There is deliberately no check for an existing timesheet over the same
    // period. Hours arrive across a month, so a volunteer who serves again
    // after one has been issued needs a second document for the new hours —
    // and refusing that stranded them, since no period both surfaces those
    // hours and avoids overlapping the issued document (VOLI-1469). What
    // must never happen is an hour being paid twice, and that is enforced
    // below by eligibility: `findEligibleTimeEntries` omits anything already
    // claimed, and `uq_invoice_time_entries_time_entry_id` makes the claim
    // exclusive in the database rather than by reasoning about dates.
    // Hours are also unit-scoped: eligibility uses the invoice's
    // organization unit.
    const eligibilityUnitId =
      input.organizationUnitId ??
      (await this.organizationService.requireRootUnit(organizationId)).id;
    const eligibleEntries = await this.findEligibleTimeEntries(
      input.volunteerId,
      input.reimbursementTypeId,
      eligibilityUnitId,
      input.periodStart,
      input.periodEnd,
    );
    const eligibleById = new Map(
      eligibleEntries.map((entry) => [entry.id, entry]),
    );
    const selected = input.timeEntryIds.map((id) => {
      const entry = eligibleById.get(id);
      if (!entry) {
        throw new ConflictGraphQLError(
          `Time entry ${id} is not eligible for this invoice`,
        );
      }
      return entry;
    });

    const totalHours =
      Math.round(
        selected.reduce((sum, entry) => sum + this.durationHours(entry), 0) *
          100,
      ) / 100;
    // A coordinator can pay this one timesheet at a different rate — for a
    // single person or a single month — without moving what the organisation
    // pays everyone else. The figure below is what the yearly allowance then
    // counts, because it is what is actually paid out.
    const rateCents =
      input.hourlyRateCents ??
      (await this.reimbursementRateService.getEffectiveRateCents(
        organizationId,
        input.organizationUnitId,
        input.reimbursementTypeId,
      ));
    if (!Number.isInteger(rateCents) || rateCents <= 0) {
      throw new BadRequestGraphQLError(
        'The hourly rate for this timesheet must be a positive amount in cents',
      );
    }
    const totalAmountCents = Math.round(totalHours * rateCents);

    const template = await this.documentTemplateService.findActiveTemplate(
      organizationId,
      input.reimbursementTypeId,
      DocumentKind.INVOICE,
      input.organizationUnitId,
    );
    const orderedSignees =
      await this.documentTemplateService.findOrderedTemplateSignees(
        template.id,
      );

    // The unit must have the profile fields its documents render (e.g. city /
    // address) before one is created — otherwise the PDF comes out with gaps
    // the org can't fix inline. The account manager is told to complete the
    // unit's profile first.
    const missingOrg =
      await this.documentProfileRequirementService.missingOrgProfileSources(
        organizationId,
        input.organizationUnitId,
        template.body,
      );
    if (missingOrg.length > 0) {
      throw new BadRequestGraphQLError(
        'Your organization is missing details required for this document: ' +
          missingOrg.join(', ') +
          '. Please complete your organization profile before creating documents.',
      );
    }

    // Compliance is per time entry: a timesheet is compliant when every hour
    // on it sits inside some ACTIVE contract, and different entries may sit
    // under different contracts. Only ACTIVE counts here; a draft or a
    // contract still awaiting signatures is its own task, not cover.
    const coverByEntry = await this.contractService.findCoveringContracts(
      coverageTargetsForTimeEntries(selected),
      ContractCover.ACTIVE,
    );
    const uncovered = entriesWithoutCover(selected, coverByEntry);

    // A draft is only needed for an entry no non-declined contract covers: a
    // draft or a contract awaiting signatures is already its own task. This
    // one query skips the entries already openly covered before the loop;
    // an entry that a draft queued inside the loop swallows still reaches
    // `ensureDraftContract`, which decides for itself and returns early.
    const openCover = await this.contractService.findCoveringContracts(
      coverageTargetsForTimeEntries(uncovered),
      ContractCover.OPEN,
    );
    const needDraft = uncovered.filter(
      (entry) => (openCover.get(entry.id) ?? []).length === 0,
    );

    // One draft per entry that needs one, oldest first and one at a time. The
    // order decides the result: the oldest entry's draft is queued first, so
    // a later entry that draft contains queues nothing, whereas newest first
    // could queue a narrower range and then the year around it.
    for (const entry of needDraft) {
      await this.contractService.ensureDraftContract(
        organizationId,
        {
          organizationUnitId: input.organizationUnitId,
          volunteerId: input.volunteerId,
          reimbursementTypeId: input.reimbursementTypeId,
          anchorDate: entry.startedAt,
        },
        actorUserId,
      );
    }

    const fieldOverrides = toFieldOverridesMap(input.fieldOverrides);
    // An org-wide template leaves `organizationUnitId` null, but the number
    // still has to be unique within the body issuing it — so the series belongs
    // to the unit if there is one, and to the organisation's root unit if not.
    const documentNumberScopeUnitId =
      input.organizationUnitId ??
      (await this.organizationService.requireRootUnit(organizationId)).id;
    // The series restarts each January, so a document's year is part of which
    // counter it draws from. Taken from the period the timesheet covers rather
    // than from today, so a January document issued in February still belongs
    // to January's books.
    const documentNumberYear = appDateParts(input.periodStart).year;

    const invoice = await this.db.transaction(async (tx) => {
      // Allocated inside the transaction so two coordinators issuing at once
      // cannot read the same counter; the unique index on
      // (scope unit, document number) is the backstop if they do.
      const [{ highest } = { highest: null }] = await tx
        .select({ highest: max(schema.invoices.documentNumberSeq) })
        .from(schema.invoices)
        .where(
          and(
            eq(
              schema.invoices.documentNumberScopeUnitId,
              documentNumberScopeUnitId,
            ),
            eq(schema.invoices.documentNumberYear, documentNumberYear),
          ),
        );
      const documentNumberSeq = (highest ?? 0) + 1;

      const [created] = await tx
        .insert(schema.invoices)
        .values({
          documentTemplateId: template.id,
          volunteerId: input.volunteerId,
          reimbursementTypeId: input.reimbursementTypeId,
          organizationUnitId: input.organizationUnitId,
          invoiceStatus: this.nextInvoiceStatus(orderedSignees[0].signeeType),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalAmountCents,
          totalHours,
          hourlyRateCents: rateCents,
          isNonCompliant: uncovered.length > 0,
          resolvedBody: structuredClone(template.body),
          fieldOverrides,
          documentNumberScopeUnitId,
          documentNumberSeq,
          documentNumberYear,
          documentNumber: formatInvoiceNumber({
            invoiceFormat: template.invoiceNumberFormat,
            periodStart: input.periodStart,
            // The coordinator may have typed a cost centre for this one
            // document; the template's own value is the default behind it.
            kostenstelle:
              fieldOverrides.kostenstelle ??
              findManualFieldValue(
                (template.body ?? {}) as TemplateBodyShape,
                'kostenstelle',
              ),
            sequence: documentNumberSeq,
          }),
        })
        .returning();

      await tx.insert(schema.invoiceSignatures).values(
        orderedSignees.map((signee) => ({
          invoiceId: created.id,
          order: signee.order,
          signeeType: signee.signeeType,
          requiredPermissionId: signee.requiredPermissionId,
        })),
      );

      // Claim the time entries immediately so they can't be pulled into a
      // second invoice while this one is still pending signatures.
      await tx.insert(schema.invoiceTimeEntries).values(
        selected.map((entry) => ({
          invoiceId: created.id,
          timeEntryId: entry.id,
        })),
      );

      await tx.insert(schema.invoiceStatusChanges).values({
        invoiceId: created.id,
        type: DocumentStatusChange.CREATED,
        actorUserId,
      });

      // The initial yearly amount is part of the same draft as the timesheet:
      // it is only written once the coordinator actually sends, so cancelling
      // the creation dialog leaves no change behind (VOLI-1569).
      if (input.manualBaselineCents != null) {
        await tx
          .insert(schema.reimbursementManualBaselines)
          .values({
            organizationId,
            volunteerId: input.volunteerId,
            reimbursementTypeId: input.reimbursementTypeId,
            year: documentNumberYear,
            amountCents: input.manualBaselineCents,
            updatedByUserId: actorUserId,
          })
          .onConflictDoUpdate({
            target: [
              schema.reimbursementManualBaselines.organizationId,
              schema.reimbursementManualBaselines.volunteerId,
              schema.reimbursementManualBaselines.reimbursementTypeId,
              schema.reimbursementManualBaselines.year,
            ],
            set: {
              amountCents: input.manualBaselineCents,
              updatedByUserId: actorUserId,
            },
          });
      }

      return created;
    });

    // Render the unsigned PDF now so the volunteer can preview the document
    // before they sign it. Previously the file was only produced after the
    // final signature, so the volunteer was asked to sign/decline content
    // they could never see (VOLI-1216). Rendering here is best-effort — a
    // storage/config failure just leaves downloadUrl unset for now.
    const fullInvoice = await this.findInvoice(invoice.id);
    await this.documentRenderingService.renderAndAttachPdf(
      fullInvoice,
      actorUserId,
    );

    this.postHogService.capture({
      event: POSTHOG_EVENT.INVOICE_CREATE,
      userId: invoice.volunteerId || actorUserId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: organizationId,
        organization_unit_id: input.organizationUnitId ?? undefined,
      },
    });

    // The volunteer only hears about the document when it needs their
    // signature — generation itself is not news (accounting-volunteer-documents).
    if (invoice.invoiceStatus === InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE) {
      await this.documentNotificationService.notifyAwaitingVolunteerSignature({
        organizationId,
        volunteerUserId: invoice.volunteerId,
        documentId: invoice.id,
        documentKind: DocumentKind.INVOICE,
      });
    }

    return invoice;
  }

  async signInvoice(
    invoiceId: string,
    userId: string,
    organizationUnitId: string,
  ): Promise<InvoiceEntity> {
    const invoice = await this.findInvoice(invoiceId);
    this.documentSigningService.assertAwaitingSignature(invoice.invoiceStatus, [
      InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE,
      InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
    ]);

    const orderedSignatures = this.documentSigningService.orderSignatures(
      invoice.signatures,
    );
    const pendingIndex = orderedSignatures.findIndex((s) => !s.signedAt);
    const pending = this.documentSigningService.assertPendingSignature(
      pendingIndex,
      orderedSignatures,
    );

    await this.documentSigningService.assertSigneeAuthorized(
      userId,
      invoice.volunteerId,
      pending.signeeType,
      pending.requiredPermissionId,
      organizationUnitId,
    );

    // The volunteer's own signature is the first step of the chain. Require
    // the profile fields the template reads before they can sign, so the
    // signed document never comes out with "—" gaps in place of them.
    if (pending.signeeType === SigneeType.VOLUNTEER) {
      const missing =
        await this.documentProfileRequirementService.missingProfileSources(
          invoice.volunteerId,
          invoice.documentTemplate.body,
        );
      if (missing.length > 0) {
        throw new BadRequestGraphQLError(
          'Your profile is missing details required for this document: ' +
            missing.join(', ') +
            '. Please complete your profile before signing.',
        );
      }
    }

    const isFinal = pendingIndex === orderedSignatures.length - 1;

    const signedByName = await this.documentSigningService.signerNameOf(userId);

    const updated = await this.db.transaction(async (tx) => {
      await tx
        .update(schema.invoiceSignatures)
        .set({ signedByUserId: userId, signedByName, signedAt: new Date() })
        .where(eq(schema.invoiceSignatures.id, pending.id));

      const [signed] = await tx
        .update(schema.invoices)
        .set({
          invoiceStatus: isFinal
            ? InvoiceStatus.READY
            : this.nextInvoiceStatus(
                orderedSignatures[pendingIndex + 1].signeeType,
              ),
        })
        .where(eq(schema.invoices.id, invoiceId))
        .returning();

      await tx.insert(schema.invoiceStatusChanges).values({
        invoiceId,
        type:
          pendingIndex === 0
            ? DocumentStatusChange.SIGNED
            : DocumentStatusChange.COUNTERSIGNED,
        actorUserId: userId,
      });

      if (isFinal) {
        await tx.insert(schema.invoiceStatusChanges).values({
          invoiceId,
          type: DocumentStatusChange.ACTIVATED,
          actorUserId: userId,
        });

        const timeEntryIds = invoice.invoiceTimeEntries.map(
          (entry) => entry.timeEntryId,
        );
        if (timeEntryIds.length > 0) {
          await tx
            .update(schema.timeEntries)
            .set({ isPaid: true })
            .where(inArray(schema.timeEntries.id, timeEntryIds));
        }
      }

      return signed;
    });

    const full = await this.findInvoice(invoiceId);
    await this.documentRenderingService.renderAndAttachPdf(full, userId);

    this.postHogService.capture({
      event: POSTHOG_EVENT.INVOICE_SIGN,
      userId: invoice.volunteerId || userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: this.documentSigningService.organizationIdOf(
          invoice.documentTemplate,
        ),
      },
    });

    return updated;
  }

  async declineInvoice(
    invoiceId: string,
    userId: string,
    reason: string,
    organizationUnitId: string,
  ): Promise<InvoiceEntity> {
    this.documentSigningService.assertReason(reason);
    const invoice = await this.findInvoice(invoiceId);
    this.documentSigningService.assertAwaitingSignature(invoice.invoiceStatus, [
      InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE,
      InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE,
    ]);

    const pending = this.documentSigningService
      .orderSignatures(invoice.signatures)
      .find((s) => !s.signedAt);
    if (!pending) {
      throw new ConflictGraphQLError(
        `Invoice with ID ${invoiceId} has no pending signature`,
      );
    }

    await this.documentSigningService.assertSigneeAuthorized(
      userId,
      invoice.volunteerId,
      pending.signeeType,
      pending.requiredPermissionId,
      organizationUnitId,
    );

    const updated = await this.db.transaction(async (tx) => {
      const [declined] = await tx
        .update(schema.invoices)
        .set({
          invoiceStatus: InvoiceStatus.DECLINED,
          declineReason: reason,
          declinedByUserId: userId,
          declinedAt: new Date(),
          declinedAtSigneeType: pending.signeeType,
        })
        .where(eq(schema.invoices.id, invoiceId))
        .returning();

      await tx.insert(schema.invoiceStatusChanges).values({
        invoiceId,
        type: DocumentStatusChange.DECLINED,
        actorUserId: userId,
      });

      // Release the time entries this invoice had claimed. The declined
      // invoice and its invoiceTimeEntries rows stay around as a record
      // (and still show what was declined), but the entries themselves
      // become selectable again for a replacement document.
      await tx
        .update(schema.invoiceTimeEntries)
        .set({ released: true })
        .where(eq(schema.invoiceTimeEntries.invoiceId, invoiceId));

      return declined;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.INVOICE_DECLINE,
      userId: invoice.volunteerId || userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: this.documentSigningService.organizationIdOf(
          invoice.documentTemplate,
        ),
      },
    });

    const organizationId = this.documentSigningService.organizationIdOf(
      invoice.documentTemplate,
    );

    // The org-side decline is news to the volunteer — they had signed and
    // would otherwise never learn the document is dead. The volunteer-side
    // decline is news to whoever manages accounting — they need to correct
    // and reissue the document (VOLI-1246).
    if (updated.declinedAtSigneeType === SigneeType.PERMISSION_HOLDER) {
      await this.documentNotificationService.notifyDeclinedByOrg({
        organizationId,
        volunteerUserId: invoice.volunteerId,
        documentId: invoiceId,
        documentKind: DocumentKind.INVOICE,
        reason,
      });
    } else {
      await this.documentNotificationService.notifyDeclinedByVolunteer({
        organizationId,
        volunteerUserId: invoice.volunteerId,
        documentId: invoiceId,
        documentKind: DocumentKind.INVOICE,
        reason,
      });
    }

    return updated;
  }

  async findInvoiceStatusChanges(
    invoiceId: string,
  ): Promise<InvoiceStatusChangeEntity[]> {
    return this.db.query.invoiceStatusChanges.findMany({
      where: { invoiceId },
      orderBy: { occurredAt: 'asc', type: 'asc' },
    });
  }

  async findPendingInvoiceSignee(
    invoiceId: string,
    organizationUnitId: string,
  ): Promise<PendingSignee | null> {
    const invoice = await this.findInvoice(invoiceId);
    return this.documentSigningService.resolvePendingSignee(
      invoice.signatures,
      invoice.volunteerId,
      organizationUnitId,
    );
  }

  private nextInvoiceStatus(signeeType: SigneeType): InvoiceStatus {
    return signeeType === SigneeType.VOLUNTEER
      ? InvoiceStatus.AWAITING_VOLUNTEER_SIGNATURE
      : InvoiceStatus.AWAITING_SUPERVISOR_SIGNATURE;
  }

  private durationHours(entry: TimeEntryEntity): number {
    if (!entry.endedAt) {
      throw new ConflictGraphQLError(
        `Time entry ${entry.id} has not been ended yet`,
      );
    }
    return (entry.endedAt.getTime() - entry.startedAt.getTime()) / 3_600_000;
  }
}

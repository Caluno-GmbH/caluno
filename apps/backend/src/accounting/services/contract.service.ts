import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, gte, inArray, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
  NotFoundGraphQLError,
} from '../../graphql/errors';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../../shared/observability/posthog.events';
import { PostHogService } from '../../shared/observability/posthog.service';
import type {
  ContractFilter,
  ContractWithRelations,
  PendingSignee,
} from '../accounting.types';
import {
  ContractStatus,
  DocumentKind,
  DocumentStatusChange,
  SigneeType,
} from '../enums';
import type { CreateContractInput } from '../inputs/create-contract.input';
import { toFieldOverridesMap } from '../inputs/document-field-override.input';
import type { ContractBody, ContractEntity } from '../schemas/contract.schema';
import type { ContractStatusChangeEntity } from '../schemas/contract-status-change.schema';
import type { DocumentTemplateEntity } from '../schemas/document-template.schema';
import type { TemplateSigneeEntity } from '../schemas/template-signee.schema';
import { type BillingPeriod, periodCovers } from '../utils/billing-period';
import {
  ContractCover,
  type CoverageTarget,
  matchCoveringContracts,
} from '../utils/contract-coverage';
import {
  CONTRACT_LIFESPAN_FIELD_ID,
  draftPeriodForAnchor,
  formatLifespanForPeriod,
} from '../utils/contract-lifespan';
import { DocumentNotificationService } from './document-notification.service';
import { DocumentProfileRequirementService } from './document-profile-requirement.service';
import { DocumentRenderingService } from './document-rendering.service';
import { DocumentSigningService } from './document-signing.service';
import { DocumentTemplateService } from './document-template.service';
import {
  findManualFieldValue,
  type TemplateBodyShape,
  withManualFieldValue,
} from './document-template.types';

// Periods end exclusively, so one ending exactly at the range start doesn't
// overlap it.
function contractOverlapsPeriod(periodStart: Date, periodEnd: Date) {
  return [
    gt(schema.contracts.periodEnd, periodStart),
    lt(schema.contracts.periodStart, periodEnd),
  ];
}

/** Anything that can run the relational queries: the database or a transaction. */
type DbExecutor = Pick<Database, 'query'>;

@Injectable()
export class ContractService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly documentTemplateService: DocumentTemplateService,
    private readonly documentSigningService: DocumentSigningService,
    private readonly documentNotificationService: DocumentNotificationService,
    private readonly documentProfileRequirementService: DocumentProfileRequirementService,
    private readonly documentRenderingService: DocumentRenderingService,
    private readonly postHogService: PostHogService,
  ) {}

  async findContract(id: string): Promise<ContractWithRelations> {
    const contract = await this.db.query.contracts.findFirst({
      where: { id },
      with: {
        documentTemplate: true,
        reimbursementType: true,
        signatures: { orderBy: { order: 'asc' } },
        // Postgres sorts an enum by declaration order, which is lifecycle
        // order, so `type` breaks the tie between rows of one transaction.
        statusChanges: { orderBy: { occurredAt: 'asc', type: 'asc' } },
        organizationUnit: true,
      },
    });
    if (!contract) {
      throw new NotFoundGraphQLError(`Contract with ID ${id} not found`);
    }
    return contract;
  }

  async findContractsForOrganization(
    organizationId: string,
    filter: ContractFilter = {},
  ): Promise<ContractEntity[]> {
    const conditions = [
      eq(schema.documentTemplates.organizationId, organizationId),
    ];
    if (filter.volunteerId) {
      conditions.push(eq(schema.contracts.volunteerId, filter.volunteerId));
    }
    if (filter.reimbursementTypeId) {
      conditions.push(
        eq(schema.contracts.reimbursementTypeId, filter.reimbursementTypeId),
      );
    }
    if (filter.status) {
      conditions.push(eq(schema.contracts.contractStatus, filter.status));
    }
    if (filter.issuedOnly) {
      conditions.push(
        ne(schema.contracts.contractStatus, ContractStatus.DRAFT),
      );
    }
    if (filter.periodStart && filter.periodEnd) {
      conditions.push(
        ...contractOverlapsPeriod(filter.periodStart, filter.periodEnd),
      );
    } else if (filter.periodStart) {
      conditions.push(gt(schema.contracts.periodEnd, filter.periodStart));
    } else if (filter.periodEnd) {
      conditions.push(lt(schema.contracts.periodStart, filter.periodEnd));
    }
    if (filter.organizationUnitId) {
      conditions.push(
        eq(schema.contracts.organizationUnitId, filter.organizationUnitId),
      );
    }

    const rows = await this.db
      .select({ contract: schema.contracts })
      .from(schema.contracts)
      .innerJoin(
        schema.documentTemplates,
        eq(schema.documentTemplates.id, schema.contracts.documentTemplateId),
      )
      .where(and(...conditions));

    return rows.map((row) => row.contract);
  }

  /**
   * The volunteer's ACTIVE contract of this type whose period covers the given
   * target (defaults to now). A contract is only cover for what its stated
   * period contains: a contract issued for 08/2026 must not make a September
   * invoice compliant (VOLI-1370). `contractStatus` alone isn't enough either —
   * nothing expires it once `periodEnd` passes (no expiry job runs yet), so an
   * out-of-date ACTIVE row must not count.
   */
  /**
   * The volunteer's ACTIVE contract of this type whose period fully covers the
   * given target period (defaults to the instant "now"). A contract is only
   * cover for what its stated period contains: a contract issued for 08/2026
   * must not make a September invoice — or a monthly timesheet that also spans
   * other months — compliant (VOLI-1370). `contractStatus` alone isn't enough
   * either: nothing expires it once `periodEnd` passes (no expiry job runs yet),
   * so an out-of-date ACTIVE row must not count.
   */
  async findActiveContract(
    volunteerId: string,
    reimbursementTypeId: string,
    period: BillingPeriod = { start: new Date(), end: new Date() },
  ): Promise<ContractEntity | undefined> {
    const rows = await this.findActiveCoveringContracts(
      { volunteerId, reimbursementTypeId },
      period,
    );
    return rows[0];
  }

  /**
   * The allowance types each volunteer has an ACTIVE contract for that covers
   * the given period (same coverage rule as `findActiveContract`), in one
   * query. Volunteers without any such contract are absent from the map.
   */
  async findActiveContractTypeIds(
    volunteerIds: string[],
    period: BillingPeriod = { start: new Date(), end: new Date() },
  ): Promise<Map<string, Set<string>>> {
    const typeIdsByVolunteerId = new Map<string, Set<string>>();
    if (volunteerIds.length === 0) return typeIdsByVolunteerId;

    const rows = await this.findActiveCoveringContracts(
      { volunteerId: { in: volunteerIds } },
      period,
    );
    for (const row of rows) {
      const typeIds = typeIdsByVolunteerId.get(row.volunteerId) ?? new Set();
      typeIds.add(row.reimbursementTypeId);
      typeIdsByVolunteerId.set(row.volunteerId, typeIds);
    }
    return typeIdsByVolunteerId;
  }

  /** The one place the "ACTIVE and covers the period" rule lives. */
  private async findActiveCoveringContracts(
    where: {
      volunteerId: string | { in: string[] };
      reimbursementTypeId?: string;
    },
    period: BillingPeriod,
  ): Promise<ContractEntity[]> {
    const rows = await this.db.query.contracts.findMany({
      where: {
        ...where,
        contractStatus: ContractStatus.ACTIVE,
        periodStart: { lte: period.start },
        periodEnd: { gte: period.end },
      },
    });
    return rows.filter((c) =>
      periodCovers(c.periodStart, c.periodEnd, period.start, period.end),
    );
  }

  /**
   * The contracts covering each target instant, newest first by `createdAt`,
   * keyed by the target's key — the one place per-entry coverage is resolved.
   * Coverage is per time entry: different entries of one timesheet may be
   * covered by different contracts. `ContractCover.ACTIVE` is what makes hours
   * compliant and what goes in the bundle; `ContractCover.OPEN` (anything not
   * declined) only decides whether a new draft or reminder is needed.
   *
   * One query for the whole set: it loads every contract that could cover any
   * target, and `matchCoveringContracts` applies the exact rule per target.
   * Pass `executor` to run the lookup inside a transaction.
   */
  async findCoveringContracts(
    targets: readonly CoverageTarget[],
    cover: ContractCover = ContractCover.ACTIVE,
    executor: DbExecutor = this.db,
  ): Promise<Map<string, ContractEntity[]>> {
    if (targets.length === 0) return new Map();

    let earliest = targets[0].at.getTime();
    let latest = earliest;
    for (const target of targets) {
      const instant = target.at.getTime();
      if (instant < earliest) earliest = instant;
      if (instant > latest) latest = instant;
    }

    // Exact (volunteer, type, unit) scopes rather than three IN lists, whose
    // cross product would also load contracts of pairs nobody asked about.
    const scopes = new Map<
      string,
      {
        volunteerId: string;
        reimbursementTypeId: string;
        organizationUnitId: string;
      }
    >();
    for (const target of targets) {
      scopes.set(
        [
          target.volunteerId,
          target.reimbursementTypeId,
          target.organizationUnitId,
        ].join('\u0000'),
        {
          volunteerId: target.volunteerId,
          reimbursementTypeId: target.reimbursementTypeId,
          organizationUnitId: target.organizationUnitId,
        },
      );
    }

    const candidates = await executor.query.contracts.findMany({
      where: {
        OR: [...scopes.values()],
        contractStatus:
          cover === ContractCover.ACTIVE
            ? ContractStatus.ACTIVE
            : { ne: ContractStatus.DECLINED },
        periodStart: { lte: new Date(latest) },
        periodEnd: { gt: new Date(earliest) },
      },
    });

    return matchCoveringContracts(candidates, targets, cover);
  }

  async createContract(
    organizationId: string,
    input: CreateContractInput,
    actorUserId: string,
  ): Promise<ContractEntity> {
    const template = await this.documentTemplateService.findActiveTemplate(
      organizationId,
      input.reimbursementTypeId,
      DocumentKind.CONTRACT,
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

    const draftUnitId =
      input.organizationUnitId ?? (await this.rootUnitIdOf(organizationId));

    const contract = await this.db.transaction(async (tx) => {
      // The draft queued by ensureDraftContract stands in for this contract
      // until it exists. A draft is dropped when this contract fully contains
      // it, or when it is the draft this contract was created from and the
      // two overlap in the same unit; a draft that only overlaps otherwise
      // stays, because its remaining period is still unsigned, and a source
      // draft for a period this contract never touches is still an open task. Scoped to this organization's templates: reimbursement types
      // are global, so without this join a volunteer with a draft in another
      // org could lose it here.
      const supersededDrafts = await tx
        .select({ id: schema.contracts.id })
        .from(schema.contracts)
        .innerJoin(
          schema.documentTemplates,
          eq(schema.documentTemplates.id, schema.contracts.documentTemplateId),
        )
        .where(
          and(
            eq(schema.documentTemplates.organizationId, organizationId),
            eq(schema.contracts.volunteerId, input.volunteerId),
            eq(schema.contracts.reimbursementTypeId, input.reimbursementTypeId),
            eq(schema.contracts.contractStatus, ContractStatus.DRAFT),
            or(
              and(
                eq(schema.contracts.organizationUnitId, draftUnitId),
                gte(schema.contracts.periodStart, input.periodStart),
                lte(schema.contracts.periodEnd, input.periodEnd),
              ),
              input.sourceDraftId
                ? and(
                    eq(schema.contracts.id, input.sourceDraftId),
                    eq(schema.contracts.organizationUnitId, draftUnitId),
                    lt(schema.contracts.periodStart, input.periodEnd),
                    gt(schema.contracts.periodEnd, input.periodStart),
                  )
                : undefined,
            ),
          ),
        );

      if (supersededDrafts.length > 0) {
        await tx.delete(schema.contracts).where(
          inArray(
            schema.contracts.id,
            supersededDrafts.map((draft) => draft.id),
          ),
        );
      }

      const [created] = await tx
        .insert(schema.contracts)
        .values({
          documentTemplateId: template.id,
          volunteerId: input.volunteerId,
          reimbursementTypeId: input.reimbursementTypeId,
          organizationUnitId: input.organizationUnitId,
          contractStatus: this.nextContractStatus(orderedSignees[0].signeeType),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          resolvedBody: structuredClone(template.body),
          fieldOverrides: toFieldOverridesMap(input.fieldOverrides),
        })
        .returning();

      await tx.insert(schema.contractSignatures).values(
        orderedSignees.map((signee) => ({
          contractId: created.id,
          order: signee.order,
          signeeType: signee.signeeType,
          requiredPermissionId: signee.requiredPermissionId,
        })),
      );

      await tx.insert(schema.contractStatusChanges).values({
        contractId: created.id,
        type: DocumentStatusChange.CREATED,
        actorUserId,
      });

      // The draft's own history is gone (its status changes cascade-deleted
      // with it), so record the replacement on the surviving contract.
      if (supersededDrafts.length > 0) {
        await tx.insert(schema.contractStatusChanges).values({
          contractId: created.id,
          type: DocumentStatusChange.DRAFT_SUPERSEDED,
          actorUserId,
        });
      }

      return created;
    });

    // Render the unsigned PDF now so the volunteer can preview the document
    // before they sign it. Previously the file was only produced after the
    // final signature, so the volunteer was asked to sign/decline content
    // they could never see (VOLI-1216). Rendering here is best-effort — a
    // storage/config failure just leaves downloadUrl unset for now.
    const fullContract = await this.findContract(contract.id);
    await this.documentRenderingService.renderAndAttachPdf(
      fullContract,
      actorUserId,
    );

    this.postHogService.capture({
      event: POSTHOG_EVENT.CONTRACT_CREATE,
      userId: contract.volunteerId || actorUserId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: organizationId,
        organization_unit_id: input.organizationUnitId ?? undefined,
      },
    });

    // The volunteer only hears about the document when it needs their
    // signature — generation itself is not news (accounting-volunteer-documents).
    if (
      contract.contractStatus === ContractStatus.AWAITING_VOLUNTEER_SIGNATURE
    ) {
      await this.documentNotificationService.notifyAwaitingVolunteerSignature({
        organizationId,
        volunteerUserId: contract.volunteerId,
        documentId: contract.id,
        documentKind: DocumentKind.CONTRACT,
      });
    }

    return contract;
  }

  /** The organisation's root unit id; drafts always carry a unit so they count as cover. */
  private async rootUnitIdOf(organizationId: string): Promise<string> {
    const root = await this.db.query.organizationUnits.findFirst({
      where: { organizationId, parentId: { isNull: true } },
      columns: { id: true },
    });
    if (!root) {
      throw new NotFoundGraphQLError(
        `No root organization unit found for organization ${organizationId}`,
      );
    }
    return root.id;
  }

  /**
   * Queues the volunteer's Vereinbarung as a DRAFT when no non-declined
   * contract of the same unit covers the anchor date for the reimbursement
   * type (`ContractCover.OPEN`: a draft or awaiting-signature contract is
   * already a task). The draft's period follows the template's Vertragslaufzeit
   * applied to the anchor (year, month, or the stored range when it contains
   * the anchor; otherwise the anchor's calendar year), and the draft prints that
   * same period in its body. Runs when paid hours first appear and when a
   * timesheet is created. Returns the draft, or undefined if a covering
   * contract already exists.
   */
  async ensureDraftContract(
    organizationId: string,
    input: {
      organizationUnitId?: string | null;
      volunteerId: string;
      reimbursementTypeId: string;
      /** Instant that must be covered by an existing contract. */
      anchorDate: Date;
    },
    actorUserId: string,
  ): Promise<ContractEntity | undefined> {
    const organizationUnitId =
      input.organizationUnitId ?? (await this.rootUnitIdOf(organizationId));
    const target: CoverageTarget = {
      key: 'anchor',
      volunteerId: input.volunteerId,
      reimbursementTypeId: input.reimbursementTypeId,
      organizationUnitId,
      at: input.anchorDate,
    };
    const isCovered = async (executor: DbExecutor) => {
      const covering = await this.findCoveringContracts(
        [target],
        ContractCover.OPEN,
        executor,
      );
      return (covering.get(target.key) ?? []).length > 0;
    };

    // Cheap path first: most closed entries are already covered, and then
    // neither the template nor a lock is needed.
    if (await isCovered(this.db)) return undefined;

    const template = await this.documentTemplateService.findActiveTemplate(
      organizationId,
      input.reimbursementTypeId,
      DocumentKind.CONTRACT,
      input.organizationUnitId,
    );
    const orderedSignees =
      await this.documentTemplateService.findOrderedTemplateSignees(
        template.id,
      );
    const period = draftPeriodForAnchor(
      findManualFieldValue(
        (template.body ?? {}) as TemplateBodyShape,
        CONTRACT_LIFESPAN_FIELD_ID,
      ),
      input.anchorDate,
    );

    return this.db.transaction(async (tx) => {
      // Two entries closing at once must not both queue a draft for the same
      // volunteer, type and unit: serialise the check and the insert.
      const lockKey = [
        input.volunteerId,
        input.reimbursementTypeId,
        organizationUnitId,
      ].join(':');
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
      if (await isCovered(tx)) return undefined;

      return this.insertDraft(
        tx,
        template,
        orderedSignees,
        {
          organizationUnitId,
          volunteerId: input.volunteerId,
          reimbursementTypeId: input.reimbursementTypeId,
          periodStart: period.start,
          periodEnd: period.end,
        },
        actorUserId,
      );
    });
  }

  async createDraftContract(
    organizationId: string,
    input: CreateContractInput,
    actorUserId: string,
  ): Promise<ContractEntity> {
    const template = await this.documentTemplateService.findActiveTemplate(
      organizationId,
      input.reimbursementTypeId,
      DocumentKind.CONTRACT,
      input.organizationUnitId,
    );
    const orderedSignees =
      await this.documentTemplateService.findOrderedTemplateSignees(
        template.id,
      );
    const organizationUnitId =
      input.organizationUnitId ?? (await this.rootUnitIdOf(organizationId));

    return this.db.transaction((tx) =>
      this.insertDraft(
        tx,
        template,
        orderedSignees,
        {
          organizationUnitId,
          volunteerId: input.volunteerId,
          reimbursementTypeId: input.reimbursementTypeId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
        actorUserId,
      ),
    );
  }

  /**
   * Inserts a DRAFT whose body prints the period it is stored with: the
   * template's concrete Vertragslaufzeit would otherwise disagree with
   * `periodStart`/`periodEnd` (VOLI-1370).
   */
  private async insertDraft(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    template: DocumentTemplateEntity,
    orderedSignees: TemplateSigneeEntity[],
    draft: {
      organizationUnitId: string;
      volunteerId: string;
      reimbursementTypeId: string;
      periodStart: Date;
      periodEnd: Date;
    },
    actorUserId: string,
  ): Promise<ContractEntity> {
    const [created] = await tx
      .insert(schema.contracts)
      .values({
        documentTemplateId: template.id,
        volunteerId: draft.volunteerId,
        reimbursementTypeId: draft.reimbursementTypeId,
        organizationUnitId: draft.organizationUnitId,
        contractStatus: ContractStatus.DRAFT,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        // The same snapshot shape the template body has; only the lifespan
        // value changes, so the structural body type carries over.
        resolvedBody: withManualFieldValue(
          (template.body ?? {}) as TemplateBodyShape,
          CONTRACT_LIFESPAN_FIELD_ID,
          formatLifespanForPeriod({
            start: draft.periodStart,
            end: draft.periodEnd,
          }),
        ) as unknown as ContractBody,
      })
      .returning();

    await tx.insert(schema.contractSignatures).values(
      orderedSignees.map((signee) => ({
        contractId: created.id,
        order: signee.order,
        signeeType: signee.signeeType,
        requiredPermissionId: signee.requiredPermissionId,
      })),
    );

    await tx.insert(schema.contractStatusChanges).values({
      contractId: created.id,
      type: DocumentStatusChange.CREATED,
      actorUserId,
    });

    return created;
  }

  async signContract(
    contractId: string,
    userId: string,
    organizationUnitId: string,
  ): Promise<ContractEntity> {
    const contract = await this.findContract(contractId);
    this.documentSigningService.assertAwaitingSignature(
      contract.contractStatus,
      [
        ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        ContractStatus.AWAITING_NGO_SIGNATURE,
      ],
    );

    const orderedSignatures = this.documentSigningService.orderSignatures(
      contract.signatures,
    );
    const pendingIndex = orderedSignatures.findIndex((s) => !s.signedAt);
    const pending = this.documentSigningService.assertPendingSignature(
      pendingIndex,
      orderedSignatures,
    );

    await this.documentSigningService.assertSigneeAuthorized(
      userId,
      contract.volunteerId,
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
          contract.volunteerId,
          contract.documentTemplate.body,
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
        .update(schema.contractSignatures)
        .set({ signedByUserId: userId, signedByName, signedAt: new Date() })
        .where(eq(schema.contractSignatures.id, pending.id));

      const [signed] = await tx
        .update(schema.contracts)
        .set({
          contractStatus: isFinal
            ? ContractStatus.ACTIVE
            : this.nextContractStatus(
                orderedSignatures[pendingIndex + 1].signeeType,
              ),
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      await tx.insert(schema.contractStatusChanges).values({
        contractId,
        type:
          pendingIndex === 0
            ? DocumentStatusChange.SIGNED
            : DocumentStatusChange.COUNTERSIGNED,
        actorUserId: userId,
      });
      if (isFinal) {
        await tx.insert(schema.contractStatusChanges).values({
          contractId,
          type: DocumentStatusChange.ACTIVATED,
          actorUserId: userId,
        });
      }

      return signed;
    });

    const full = await this.findContract(contractId);
    await this.documentRenderingService.renderAndAttachPdf(full, userId);

    this.postHogService.capture({
      event: POSTHOG_EVENT.CONTRACT_SIGN,
      userId: contract.volunteerId || userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: this.documentSigningService.organizationIdOf(
          contract.documentTemplate,
        ),
      },
    });

    return updated;
  }

  async declineContract(
    contractId: string,
    userId: string,
    reason: string,
    organizationUnitId: string,
  ): Promise<ContractEntity> {
    this.documentSigningService.assertReason(reason);
    const contract = await this.findContract(contractId);
    this.documentSigningService.assertAwaitingSignature(
      contract.contractStatus,
      [
        ContractStatus.AWAITING_VOLUNTEER_SIGNATURE,
        ContractStatus.AWAITING_NGO_SIGNATURE,
      ],
    );

    const pending = this.documentSigningService
      .orderSignatures(contract.signatures)
      .find((s) => !s.signedAt);
    if (!pending) {
      throw new ConflictGraphQLError(
        `Contract with ID ${contractId} has no pending signature`,
      );
    }

    await this.documentSigningService.assertSigneeAuthorized(
      userId,
      contract.volunteerId,
      pending.signeeType,
      pending.requiredPermissionId,
      organizationUnitId,
    );

    const updated = await this.db.transaction(async (tx) => {
      const [declined] = await tx
        .update(schema.contracts)
        .set({
          contractStatus: ContractStatus.DECLINED,
          declineReason: reason,
          declinedByUserId: userId,
          declinedAt: new Date(),
          declinedAtSigneeType: pending.signeeType,
        })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      await tx.insert(schema.contractStatusChanges).values({
        contractId,
        type: DocumentStatusChange.DECLINED,
        actorUserId: userId,
      });

      return declined;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.CONTRACT_DECLINE,
      userId: contract.volunteerId || userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: this.documentSigningService.organizationIdOf(
          contract.documentTemplate,
        ),
      },
    });

    const organizationId = this.documentSigningService.organizationIdOf(
      contract.documentTemplate,
    );

    // The org-side decline is news to the volunteer — they had signed and
    // would otherwise never learn the document is dead. The volunteer-side
    // decline is news to whoever manages accounting — they need to correct
    // and reissue the document (VOLI-1246).
    if (updated.declinedAtSigneeType === SigneeType.PERMISSION_HOLDER) {
      await this.documentNotificationService.notifyDeclinedByOrg({
        organizationId,
        volunteerUserId: contract.volunteerId,
        documentId: contractId,
        documentKind: DocumentKind.CONTRACT,
        reason,
      });
    } else {
      await this.documentNotificationService.notifyDeclinedByVolunteer({
        organizationId,
        volunteerUserId: contract.volunteerId,
        documentId: contractId,
        documentKind: DocumentKind.CONTRACT,
        reason,
      });
    }

    return updated;
  }

  async findContractStatusChanges(
    contractId: string,
  ): Promise<ContractStatusChangeEntity[]> {
    return this.db.query.contractStatusChanges.findMany({
      where: { contractId },
      orderBy: { occurredAt: 'asc', type: 'asc' },
    });
  }

  async findPendingContractSignee(
    contractId: string,
    organizationUnitId: string,
  ): Promise<PendingSignee | null> {
    const contract = await this.findContract(contractId);
    return this.documentSigningService.resolvePendingSignee(
      contract.signatures,
      contract.volunteerId,
      organizationUnitId,
    );
  }

  private nextContractStatus(signeeType: SigneeType): ContractStatus {
    return signeeType === SigneeType.VOLUNTEER
      ? ContractStatus.AWAITING_VOLUNTEER_SIGNATURE
      : ContractStatus.AWAITING_NGO_SIGNATURE;
  }
}

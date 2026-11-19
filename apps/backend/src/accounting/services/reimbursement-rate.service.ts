import { Inject, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { and, eq, gte, inArray, isNull, lt, lte, ne } from 'drizzle-orm';
import type { UserEntity } from '../../auth/schemas/auth.schema';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';
import {
  BadRequestGraphQLError,
  NotFoundGraphQLError,
} from '../../graphql/errors';
import { MembershipService } from '../../membership/membership.service';
import { OrganizationUnitDataService } from '../../organization/organization-unit-data.service';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../../shared/observability/posthog.events';
import { PostHogService } from '../../shared/observability/posthog.service';
import type {
  EffectiveRate,
  RateProvenance,
  YearlyUsage,
} from '../accounting.types';
import {
  InvoiceStatus,
  RateProvenanceKind,
  ReimbursementTypeKey,
} from '../enums';
import type { ReimbursementBundleDownloadEntity } from '../schemas/reimbursement-bundle-download.schema';
import type { ManualBaselineEntity } from '../schemas/reimbursement-manual-baseline.schema';
import type { ReimbursementRateEntity } from '../schemas/reimbursement-rate.schema';
import type { ReimbursementTypeEntity } from '../schemas/reimbursement-type.schema';
import { billingYearBounds } from '../utils/billing-period';

export interface ReimbursementTypeUsageResult {
  reimbursementType: ReimbursementTypeEntity;
  usedCents: number;
  limitCents: number;
  remainingCents: number;
}

export interface VolunteerYearlyUsageResult {
  volunteer: UserEntity;
  usageByType: ReimbursementTypeUsageResult[];
}

/** Composite key for the unit-and-type override lookup map below. */
const overrideKey = (
  organizationUnitId: string | null,
  reimbursementTypeKey: ReimbursementTypeKey,
): string => `${organizationUnitId ?? 'org'}:${reimbursementTypeKey}`;

@Injectable()
export class ReimbursementRateService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly organizationUnitDataService: OrganizationUnitDataService,
    private readonly membershipService: MembershipService,
    private readonly postHogService: PostHogService,
  ) {}

  async findReimbursementTypes(): Promise<ReimbursementTypeEntity[]> {
    return this.db.query.reimbursementTypes.findMany();
  }

  /**
   * Ordered [self, parent, ..., root, null] — null stands for the org-wide
   * row. When no `organizationUnitId` is given (e.g. a caller resolving a
   * rate outside any unit context), the chain is just [null] so resolution
   * falls straight through to the org-wide override or the platform default.
   */
  private async resolutionChain(
    organizationUnitId: string | null | undefined,
  ): Promise<(string | null)[]> {
    if (!organizationUnitId) {
      return [null];
    }
    const ancestorIds =
      await this.organizationUnitDataService.listInclusiveAncestorUnitIds(
        organizationUnitId,
      );
    return [...ancestorIds, null];
  }

  async getEffectiveRates(
    organizationId: string,
    organizationUnitId?: string | null,
  ): Promise<EffectiveRate[]> {
    const [types, chain] = await Promise.all([
      this.db.query.reimbursementTypes.findMany(),
      this.resolutionChain(organizationUnitId),
    ]);
    const unitIds = chain.filter((id): id is string => id !== null);
    const overrides = await this.db.query.reimbursementRates.findMany({
      where: {
        organizationId,
        OR: [
          { organizationUnitId: { in: unitIds } },
          { organizationUnitId: { isNull: true } },
        ],
      },
    });
    // Keyed by unit-and-type, not unit alone — a unit can carry an override
    // for each reimbursement type independently.
    const overrideByKey = new Map(
      overrides.map((override) => [
        overrideKey(override.organizationUnitId, override.reimbursementTypeKey),
        override,
      ]),
    );

    const resolve = (
      reimbursementType: ReimbursementTypeEntity,
      links: (string | null)[],
    ) => {
      for (const unitId of links) {
        const override = overrideByKey.get(
          overrideKey(unitId, reimbursementType.key),
        );
        if (override) {
          return {
            hourlyRateCents: override.hourlyRateCents,
            isOverride: true,
            organizationUnitId: unitId,
          };
        }
      }
      return {
        hourlyRateCents: reimbursementType.platformDefaultRateCents,
        isOverride: false,
        organizationUnitId: null,
      };
    };

    // The chain starts at the requested unit itself, so dropping its first
    // link resolves what the unit would fall back to without its own
    // override — the parent's rate, or the platform default at the top.
    const requestedUnitId = organizationUnitId ?? null;
    const fallbackChain = chain.slice(1);
    const [units, organization] = await Promise.all([
      this.organizationUnitDataService.findByIds(unitIds),
      this.db.query.organizations.findFirst({
        where: { id: organizationId },
        columns: { name: true },
      }),
    ]);
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    // The org-wide row belongs to no unit, so it is attributed to the
    // organisation itself.
    const nameOf = (unitId: string | null) =>
      unitId ? (unitNames.get(unitId) ?? null) : (organization?.name ?? null);

    const provenanceOf = (
      reimbursementType: ReimbursementTypeEntity,
      rate: { isOverride: boolean; organizationUnitId: string | null },
    ): RateProvenance => {
      if (!rate.isOverride) {
        return {
          kind: RateProvenanceKind.DEFAULT,
          sourceName: null,
          replacesRateCents: null,
        };
      }
      if (rate.organizationUnitId !== requestedUnitId) {
        return {
          kind: RateProvenanceKind.INHERITED,
          sourceName: nameOf(rate.organizationUnitId),
          replacesRateCents: null,
        };
      }
      const fallback = resolve(reimbursementType, fallbackChain);
      return {
        kind: RateProvenanceKind.OWN,
        sourceName: fallback.isOverride
          ? nameOf(fallback.organizationUnitId)
          : null,
        replacesRateCents: fallback.hourlyRateCents,
      };
    };

    return types.map((reimbursementType) => {
      const resolved = resolve(reimbursementType, chain);
      return {
        reimbursementType,
        ...resolved,
        provenance: provenanceOf(reimbursementType, resolved),
      };
    });
  }

  /**
   * Upserts by hand rather than via `onConflictDoUpdate`: the org-wide row
   * and unit-override row are each guarded by their own partial unique index
   * (`organizationUnitId IS NULL` / `IS NOT NULL` respectively), and Postgres
   * can't infer either as an arbiter from a plain column-list conflict
   * target. A select-then-write inside a transaction sidesteps that; a
   * concurrent duplicate insert still fails on the unique index rather than
   * silently double-writing.
   */
  async setReimbursementRate(
    organizationId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    hourlyRateCents: number,
    userId: string,
    organizationUnitId?: string,
  ): Promise<ReimbursementRateEntity> {
    if (hourlyRateCents <= 0) {
      throw new BadRequestGraphQLError('Hourly rate must be greater than zero');
    }
    await this.findReimbursementTypeByKey(reimbursementTypeKey);

    const target = organizationUnitId ?? null;

    const rate = await this.db.transaction(async (tx) => {
      const existing = await tx.query.reimbursementRates.findFirst({
        where: target
          ? { organizationUnitId: target, reimbursementTypeKey }
          : {
              organizationId,
              reimbursementTypeKey,
              organizationUnitId: { isNull: true },
            },
      });

      if (existing) {
        const [updated] = await tx
          .update(schema.reimbursementRates)
          .set({ hourlyRateCents })
          .where(eq(schema.reimbursementRates.id, existing.id))
          .returning();
        return updated;
      }

      const [inserted] = await tx
        .insert(schema.reimbursementRates)
        .values({
          organizationId,
          organizationUnitId: target,
          reimbursementTypeKey,
          hourlyRateCents,
        })
        .returning();
      return inserted;
    });

    this.postHogService.capture({
      event: POSTHOG_EVENT.REIMBURSEMENT_RATE_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        organization_id: organizationId,
        ...(organizationUnitId
          ? { organization_unit_id: organizationUnitId }
          : {}),
      },
    });

    return rate;
  }

  /**
   * Year-to-date usage for one volunteer + type inside one Organization.
   * Invoices and the Anfangsbetrag from other Organizations are never
   * included — sibling units of the same tenant are.
   *
   * `asOfDate` bounds the sum to invoices whose own period has ended by that
   * date — pass a document's `periodEnd` when computing the Jahresdeckel
   * "already received" figure so a reissued/regenerated document keeps
   * reporting the same year-to-date figure it originally stated, instead of
   * drifting with invoices created after the fact (or "today"). Omitted for
   * the live in-app usage view, which has no such reissue-consistency
   * requirement and should reflect everything on record for the year.
   */
  async getYearlyUsage(
    organizationId: string,
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    year: number,
    asOfDate?: Date,
    excludeInvoiceId?: string,
  ): Promise<YearlyUsage> {
    const { start: yearStart, end: yearEnd } = billingYearBounds(year);
    const reimbursementType =
      await this.findReimbursementTypeByKey(reimbursementTypeKey);

    const conditions = [
      eq(schema.documentTemplates.organizationId, organizationId),
      eq(schema.invoices.volunteerId, volunteerId),
      eq(schema.invoices.reimbursementTypeKey, reimbursementTypeKey),
      gte(schema.invoices.periodStart, yearStart),
      lt(schema.invoices.periodStart, yearEnd),
    ];
    if (asOfDate) {
      conditions.push(lte(schema.invoices.periodEnd, asOfDate));
    }
    // The invoice being reissued or rendered must not count toward what was
    // already received before it. A non-UUID id can't match an invoice, so
    // it's ignored.
    if (excludeInvoiceId && isUUID(excludeInvoiceId)) {
      conditions.push(ne(schema.invoices.id, excludeInvoiceId));
    }

    const [invoices, baseline] = await Promise.all([
      this.db
        .select({
          totalAmountCents: schema.invoices.totalAmountCents,
          invoiceStatus: schema.invoices.invoiceStatus,
        })
        .from(schema.invoices)
        .innerJoin(
          schema.documentTemplates,
          eq(schema.documentTemplates.id, schema.invoices.documentTemplateId),
        )
        .where(and(...conditions)),
      this.getManualBaseline(
        organizationId,
        volunteerId,
        reimbursementTypeKey,
        year,
      ),
    ]);

    const usedCents =
      invoices
        .filter((invoice) => invoice.invoiceStatus !== InvoiceStatus.DECLINED)
        .reduce((sum, invoice) => sum + invoice.totalAmountCents, 0) +
      (baseline?.amountCents ?? 0);
    const limitCents = reimbursementType.yearlyLimitCents;

    return { usedCents, limitCents, remainingCents: limitCents - usedCents };
  }

  /**
   * Roster-scale version of `getYearlyUsage`: one query per volunteer would
   * be N+1 for a board view, so this fetches every member and every
   * reimbursement type once, then aggregates invoices for the whole unit in
   * a single query keyed by volunteer-and-type. Scoped to the Organization
   * that owns `organizationUnitId`.
   */
  async getRosterYearlyUsage(
    organizationUnitId: string,
    year: number,
  ): Promise<VolunteerYearlyUsageResult[]> {
    const organization =
      await this.organizationUnitDataService.findOrganizationByUnitId(
        organizationUnitId,
      );
    if (!organization) {
      throw new NotFoundGraphQLError(
        `Organization unit with ID ${organizationUnitId} not found`,
      );
    }

    const [members, types] = await Promise.all([
      this.membershipService.getMembers(organizationUnitId),
      this.db.query.reimbursementTypes.findMany(),
    ]);
    if (members.length === 0) return [];

    const { start: yearStart, end: yearEnd } = billingYearBounds(year);
    const memberIds = members.map((member) => member.id);

    const [invoices, baselines] = await Promise.all([
      this.db
        .select({
          volunteerId: schema.invoices.volunteerId,
          reimbursementTypeKey: schema.invoices.reimbursementTypeKey,
          totalAmountCents: schema.invoices.totalAmountCents,
          invoiceStatus: schema.invoices.invoiceStatus,
        })
        .from(schema.invoices)
        .innerJoin(
          schema.documentTemplates,
          eq(schema.documentTemplates.id, schema.invoices.documentTemplateId),
        )
        .where(
          and(
            eq(schema.documentTemplates.organizationId, organization.id),
            inArray(schema.invoices.volunteerId, memberIds),
            gte(schema.invoices.periodStart, yearStart),
            lt(schema.invoices.periodStart, yearEnd),
          ),
        ),
      this.db.query.reimbursementManualBaselines.findMany({
        where: {
          organizationId: organization.id,
          volunteerId: { in: memberIds },
          year,
        },
        columns: {
          volunteerId: true,
          reimbursementTypeKey: true,
          amountCents: true,
        },
      }),
    ]);

    const usedByVolunteerAndType = new Map<string, number>();
    for (const invoice of invoices) {
      if (invoice.invoiceStatus === InvoiceStatus.DECLINED) continue;
      const key = `${invoice.volunteerId}:${invoice.reimbursementTypeKey}`;
      usedByVolunteerAndType.set(
        key,
        (usedByVolunteerAndType.get(key) ?? 0) + invoice.totalAmountCents,
      );
    }
    for (const baseline of baselines) {
      const key = `${baseline.volunteerId}:${baseline.reimbursementTypeKey}`;
      usedByVolunteerAndType.set(
        key,
        (usedByVolunteerAndType.get(key) ?? 0) + baseline.amountCents,
      );
    }

    return members.map((volunteer) => ({
      volunteer,
      usageByType: types.map((reimbursementType) => {
        const usedCents =
          usedByVolunteerAndType.get(
            `${volunteer.id}:${reimbursementType.key}`,
          ) ?? 0;
        const limitCents = reimbursementType.yearlyLimitCents;
        return {
          reimbursementType,
          usedCents,
          limitCents,
          remainingCents: limitCents - usedCents,
        };
      }),
    }));
  }

  async findReimbursementTypeByKey(
    key: ReimbursementTypeKey,
  ): Promise<ReimbursementTypeEntity> {
    // The key is a pg enum: an out-of-range value would raise a DB error
    // instead of resolving to "not found".
    const reimbursementType = await this.db.query.reimbursementTypes.findFirst({
      where: { key },
    });
    if (!reimbursementType) {
      throw new NotFoundGraphQLError(
        `Reimbursement type with ID ${key} not found`,
      );
    }
    return reimbursementType;
  }

  async getEffectiveRateCents(
    organizationId: string,
    organizationUnitId: string | null | undefined,
    reimbursementTypeKey: ReimbursementTypeKey,
  ): Promise<number> {
    const rates = await this.getEffectiveRates(
      organizationId,
      organizationUnitId,
    );
    const match = rates.find(
      (rate) => rate.reimbursementType.key === reimbursementTypeKey,
    );
    if (!match) {
      throw new NotFoundGraphQLError(
        `Reimbursement type with ID ${reimbursementTypeKey} not found`,
      );
    }
    return match.hourlyRateCents;
  }

  async getBundleDownloadStatus(
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
  ): Promise<ReimbursementBundleDownloadEntity | undefined> {
    return this.db.query.reimbursementBundleDownloads.findFirst({
      where: { volunteerId, reimbursementTypeKey },
    });
  }

  async recordBundleDownload(
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    downloadedByUserId: string,
    invoiceIds: string[] = [],
    inTransaction?: Database,
  ): Promise<ReimbursementBundleDownloadEntity> {
    const record = async (tx: Database) => {
      const [row] = await tx
        .insert(schema.reimbursementBundleDownloads)
        .values({
          volunteerId,
          reimbursementTypeKey,
          downloadedAt: new Date(),
          downloadedByUserId,
        })
        .onConflictDoUpdate({
          target: [
            schema.reimbursementBundleDownloads.volunteerId,
            schema.reimbursementBundleDownloads.reimbursementTypeKey,
          ],
          set: { downloadedAt: new Date(), downloadedByUserId },
        })
        .returning();

      await this.markInvoicesPaid(
        tx,
        volunteerId,
        reimbursementTypeKey,
        downloadedByUserId,
        invoiceIds,
      );

      return row;
    };
    return inTransaction ? record(inTransaction) : this.db.transaction(record);
  }

  /** Handing a bundle to accounting (download or email) is taken as the payment. */
  async markInvoicesPaid(
    tx: Database,
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    paidByUserId: string | null,
    invoiceIds: string[],
  ): Promise<void> {
    if (invoiceIds.length === 0) return;
    await tx
      .update(schema.invoices)
      .set({ paidAt: new Date(), paidByUserId })
      .where(
        // Only READY invoices — the terminal payable state — can be marked paid.
        and(
          inArray(schema.invoices.id, invoiceIds),
          eq(schema.invoices.volunteerId, volunteerId),
          eq(schema.invoices.reimbursementTypeKey, reimbursementTypeKey),
          eq(schema.invoices.invoiceStatus, InvoiceStatus.READY),
          isNull(schema.invoices.paidAt),
        ),
      );
  }

  async getManualBaseline(
    organizationId: string,
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    year: number,
  ): Promise<ManualBaselineEntity | undefined> {
    return this.db.query.reimbursementManualBaselines.findFirst({
      where: { organizationId, volunteerId, reimbursementTypeKey, year },
    });
  }

  async setManualBaseline(
    organizationId: string,
    volunteerId: string,
    reimbursementTypeKey: ReimbursementTypeKey,
    year: number,
    amountCents: number,
    updatedByUserId: string,
  ): Promise<ManualBaselineEntity> {
    if (amountCents < 0) {
      throw new BadRequestGraphQLError('Amount must not be negative');
    }
    await this.findReimbursementTypeByKey(reimbursementTypeKey);

    const [row] = await this.db
      .insert(schema.reimbursementManualBaselines)
      .values({
        organizationId,
        volunteerId,
        reimbursementTypeKey,
        year,
        amountCents,
        updatedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          schema.reimbursementManualBaselines.organizationId,
          schema.reimbursementManualBaselines.volunteerId,
          schema.reimbursementManualBaselines.reimbursementTypeKey,
          schema.reimbursementManualBaselines.year,
        ],
        set: { amountCents, updatedByUserId },
      })
      .returning();

    return row;
  }
}

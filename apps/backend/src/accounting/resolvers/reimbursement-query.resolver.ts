import { Args, Context, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { TenantScopeService } from '../../organization/tenant-scope.service';
import { UserMapper } from '../../user/mappers/user.mapper';
import { UserService } from '../../user/user.service';
import { ReimbursementTypeMapper } from '../mappers';
import { BundleDownloadStatus } from '../models/bundle-download-status.model';
import { EffectiveRate } from '../models/effective-rate.model';
import { ManualBaseline } from '../models/manual-baseline.model';
import { ReimbursementType } from '../models/reimbursement-type.model';
import { VolunteerYearlyUsage } from '../models/volunteer-yearly-usage.model';
import { YearlyUsage } from '../models/yearly-usage.model';
import {
  AccountingOrgAccessService,
  ReimbursementRateService,
} from '../services';

@Resolver(() => ReimbursementType)
export class ReimbursementQueryResolver {
  constructor(
    private readonly reimbursementRateService: ReimbursementRateService,
    private readonly reimbursementTypeMapper: ReimbursementTypeMapper,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly userMapper: UserMapper,
    private readonly userService: UserService,
    private readonly tenantScopeService: TenantScopeService,
  ) {}

  @Query(() => [ReimbursementType])
  async reimbursementTypes(): Promise<ReimbursementType[]> {
    const types = await this.reimbursementRateService.findReimbursementTypes();
    return this.reimbursementTypeMapper.toArray(types);
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => [EffectiveRate])
  async effectiveRates(
    @Args('organizationUnitId', { type: () => ID, nullable: true })
    organizationUnitId: string | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<EffectiveRate[]> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    if (
      organizationUnitId &&
      organizationUnitId !== context.organizationUnitId
    ) {
      await this.tenantScopeService.assertResourceInScope(
        context.organizationUnitId,
        organizationUnitId,
        'Organization unit not found',
      );
    }
    const targetUnitId = organizationUnitId ?? context.organizationUnitId;

    const rates = await this.reimbursementRateService.getEffectiveRates(
      organizationId,
      targetUnitId,
    );
    return rates.map((rate) => ({
      reimbursementType: this.reimbursementTypeMapper.toModelOrThrow(
        rate.reimbursementType,
      ),
      hourlyRateCents: rate.hourlyRateCents,
      isOverride: rate.isOverride,
      provenance: rate.provenance,
      organizationUnitId: rate.organizationUnitId,
    }));
  }

  /** A volunteer's usage: their non-declined invoices plus the initial amount. */
  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => YearlyUsage)
  async yearlyUsage(
    @Args('volunteerId', { type: () => ID }) volunteerId: string,
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: string,
    @Args('year', { type: () => Int }) year: number,
    // Same cutoff the PDF uses (the document's period end), so the
    // already-received figure in the dialog matches the generated document.
    @Args('asOfDate', { type: () => Date, nullable: true })
    asOfDate: Date | null | undefined,
    @Args('excludeInvoiceId', { type: () => ID, nullable: true })
    excludeInvoiceId: string | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<YearlyUsage> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      volunteerId,
      'Volunteer not found',
    );

    return this.reimbursementRateService.getYearlyUsage(
      organizationId,
      volunteerId,
      reimbursementTypeId,
      year,
      asOfDate ?? undefined,
      excludeInvoiceId ?? undefined,
    );
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => [VolunteerYearlyUsage])
  async rosterYearlyUsage(
    @Args('organizationUnitId', { type: () => ID }) organizationUnitId: string,
    @Args('year', { type: () => Int }) year: number,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<VolunteerYearlyUsage[]> {
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      context.organizationUnitId,
    );
    if (organizationUnitId !== context.organizationUnitId) {
      await this.tenantScopeService.assertResourceInScope(
        context.organizationUnitId,
        organizationUnitId,
        'Organization unit not found',
      );
    }

    const usage = await this.reimbursementRateService.getRosterYearlyUsage(
      organizationUnitId,
      year,
    );
    return usage.map((entry) => ({
      volunteer: this.userMapper.toModelOrThrow(entry.volunteer),
      usageByType: entry.usageByType.map((typeUsage) => ({
        reimbursementType: this.reimbursementTypeMapper.toModelOrThrow(
          typeUsage.reimbursementType,
        ),
        usedCents: typeUsage.usedCents,
        limitCents: typeUsage.limitCents,
        remainingCents: typeUsage.remainingCents,
      })),
    }));
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => BundleDownloadStatus, { nullable: true })
  async bundleDownloadStatus(
    @Args('volunteerId', { type: () => ID }) volunteerId: string,
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: string,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<BundleDownloadStatus | null> {
    await this.accountingOrgAccessService.resolveEnabledOrganizationId(
      context.organizationUnitId,
    );
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      volunteerId,
      'Volunteer not found',
    );

    const status = await this.reimbursementRateService.getBundleDownloadStatus(
      volunteerId,
      reimbursementTypeId,
    );
    if (!status) return null;

    return this.toBundleDownloadStatusModel(status);
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => ManualBaseline, { nullable: true })
  async manualBaseline(
    @Args('volunteerId', { type: () => ID }) volunteerId: string,
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: string,
    @Args('year', { type: () => Int }) year: number,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<ManualBaseline | null> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    await this.tenantScopeService.assertUserInScope(
      context.organizationUnitId,
      volunteerId,
      'Volunteer not found',
    );

    const baseline = await this.reimbursementRateService.getManualBaseline(
      organizationId,
      volunteerId,
      reimbursementTypeId,
      year,
    );
    if (!baseline) return null;

    return this.toManualBaselineModel(baseline);
  }

  private async toBundleDownloadStatusModel(status: {
    volunteerId: string;
    reimbursementTypeId: string;
    downloadedAt: Date;
    downloadedByUserId: string | null;
  }): Promise<BundleDownloadStatus> {
    const [volunteer, reimbursementType, downloadedByUser] = await Promise.all([
      this.userService.findByIdOrThrow(status.volunteerId),
      this.reimbursementRateService.findReimbursementTypeById(
        status.reimbursementTypeId,
      ),
      status.downloadedByUserId
        ? this.userService.findById(status.downloadedByUserId)
        : Promise.resolve(undefined),
    ]);

    return {
      volunteer: this.userMapper.toModelOrThrow(volunteer),
      reimbursementType:
        this.reimbursementTypeMapper.toModelOrThrow(reimbursementType),
      downloadedAt: status.downloadedAt,
      downloadedByUser: this.userMapper.toModel(downloadedByUser),
    };
  }

  private async toManualBaselineModel(baseline: {
    volunteerId: string;
    reimbursementTypeId: string;
    year: number;
    amountCents: number;
    updatedAt: Date | null;
    createdAt: Date;
    updatedByUserId: string | null;
  }): Promise<ManualBaseline> {
    const [volunteer, reimbursementType, updatedByUser] = await Promise.all([
      this.userService.findByIdOrThrow(baseline.volunteerId),
      this.reimbursementRateService.findReimbursementTypeById(
        baseline.reimbursementTypeId,
      ),
      baseline.updatedByUserId
        ? this.userService.findById(baseline.updatedByUserId)
        : Promise.resolve(undefined),
    ]);

    return {
      volunteer: this.userMapper.toModelOrThrow(volunteer),
      reimbursementType:
        this.reimbursementTypeMapper.toModelOrThrow(reimbursementType),
      year: baseline.year,
      amountCents: baseline.amountCents,
      updatedAt: baseline.updatedAt ?? baseline.createdAt,
      updatedByUser: this.userMapper.toModel(updatedByUser),
    };
  }
}

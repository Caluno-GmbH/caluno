import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { NotFoundGraphQLError } from '../../graphql/errors';
import { MembershipService } from '../../membership/membership.service';
import { appDateParts } from '../../shift/utils/app-time';
import type { BillingPeriod } from '../utils/billing-period';
import { ContractService } from './contract.service';
import { ReimbursementRateService } from './reimbursement-rate.service';
import {
  computeVolunteerAllowanceState,
  mostRestrictiveAllowanceState,
  VolunteerAllowanceState,
} from './volunteer-allowance';

export interface VolunteerAllowanceResult {
  volunteerId: string;
  state: VolunteerAllowanceState;
}

export interface GetVolunteerAllowanceStatesInput {
  organizationId: string;
  organizationUnitId: string;
  volunteerIds: string[];
  /**
   * The shift instance the volunteers are being considered for. Without it the
   * states describe the person only (nothing is projected).
   */
  shiftInstanceId?: string;
}

@Injectable()
export class VolunteerAllowanceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly membershipService: MembershipService,
    private readonly contractService: ContractService,
    private readonly reimbursementRateService: ReimbursementRateService,
  ) {}

  /**
   * One allowance state per requested member of `organizationUnitId`.
   *
   * With a paid shift instance the volunteer is judged against that shift's
   * allowance type and its projected cost (planned duration × applicable
   * hourly rate), so `WOULD_EXCEED` can appear. Otherwise (unpaid shift, or no
   * shift) it is the person's own paperwork and ceiling: every allowance type
   * they hold an active contract for, with nothing projected — the most
   * restrictive state wins, and no contract at all is `NO_AGREEMENT`.
   *
   * Reuses the shared year-to-date usage (`getRosterYearlyUsage`) and contract
   * coverage rule so the states stay consistent with the accounting surfaces.
   */
  async getVolunteerAllowanceStates(
    input: GetVolunteerAllowanceStatesInput,
  ): Promise<VolunteerAllowanceResult[]> {
    const shift = input.shiftInstanceId
      ? await this.loadShiftContext(
          input.shiftInstanceId,
          input.organizationUnitId,
        )
      : undefined;
    // Unpaid shifts don't show allowance states
    if (shift && !shift.reimbursementTypeId) {
      return [];
    }

    const paidTypeId = shift?.reimbursementTypeId ?? undefined;
    // The ceiling is per calendar year, so measure against the shift's year.
    const year = appDateParts(shift?.period.start ?? new Date()).year;

    const members = await this.membershipService.getMembers(
      input.organizationUnitId,
    );
    const memberIds = new Set(members.map((member) => member.id));
    // Never look anything up for people outside the caller's unit.
    const volunteerIds = input.volunteerIds.filter((id) => memberIds.has(id));

    const [usage, typeIdsByVolunteerId, hourlyRateCents] = await Promise.all([
      this.reimbursementRateService.getRosterYearlyUsage(
        input.organizationUnitId,
        year,
      ),
      this.contractService.findActiveContractTypeIds(
        volunteerIds,
        shift?.period,
      ),
      paidTypeId
        ? this.reimbursementRateService.getEffectiveRateCents(
            input.organizationId,
            input.organizationUnitId,
            paidTypeId,
          )
        : Promise.resolve(0),
    ]);

    const projectedCostCents = shift
      ? Math.round((hourlyRateCents * shift.durationMinutes) / 60)
      : 0;
    const usageByVolunteerId = new Map(
      usage.map((entry) => [entry.volunteer.id, entry.usageByType]),
    );

    return volunteerIds.map((volunteerId) => {
      const contractTypeIds = typeIdsByVolunteerId.get(volunteerId);
      const typeIds = paidTypeId ? [paidTypeId] : [...(contractTypeIds ?? [])];

      if (typeIds.length === 0) {
        return { volunteerId, state: VolunteerAllowanceState.NO_AGREEMENT };
      }

      const state = mostRestrictiveAllowanceState(
        typeIds.map((typeId) => {
          const typeUsage = usageByVolunteerId
            .get(volunteerId)
            ?.find((entry) => entry.reimbursementType.id === typeId);
          return computeVolunteerAllowanceState({
            hasActiveAgreement: Boolean(contractTypeIds?.has(typeId)),
            remainingCents: typeUsage?.remainingCents ?? 0,
            limitCents: typeUsage?.limitCents ?? 0,
            projectedCostCents,
          });
        }),
      );
      return { volunteerId, state };
    });
  }

  private async loadShiftContext(
    shiftInstanceId: string,
    organizationUnitId: string,
  ): Promise<{
    reimbursementTypeId: string | null;
    durationMinutes: number;
    period: BillingPeriod;
  }> {
    const instance = await this.db.query.shiftInstances.findFirst({
      where: { id: shiftInstanceId },
      with: { master: true },
    });
    if (
      !instance ||
      instance.master.organizationUnitId !== organizationUnitId
    ) {
      throw new NotFoundGraphQLError('Shift instance not found');
    }
    return {
      reimbursementTypeId: instance.master.reimbursementTypeId,
      durationMinutes: Math.max(
        0,
        Math.round(
          (instance.actualEndsAt.getTime() -
            instance.actualStartsAt.getTime()) /
            60_000,
        ),
      ),
      period: { start: instance.actualStartsAt, end: instance.actualEndsAt },
    };
  }
}

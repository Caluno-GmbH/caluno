import { Args, Context, ID, Query, Resolver } from '@nestjs/graphql';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { VolunteerAllowance } from '../models/volunteer-allowance.model';
import {
  AccountingOrgAccessService,
  VolunteerAllowanceService,
} from '../services';

@Resolver(() => VolunteerAllowance)
export class VolunteerAllowanceQueryResolver {
  constructor(
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly volunteerAllowanceService: VolunteerAllowanceService,
  ) {}

  /**
   * One allowance state per requested member of the caller's unit. With a
   * `shiftInstanceId` the states are measured against that shift (its
   * allowance type, planned duration and period); without one they describe
   * the person only.
   *
   * Status signals only: never returns or implies a euro amount. Gated on the
   * right to staff shifts (shift edit), not accounting: planners see states,
   * while amounts stay behind the accounting rights.
   */
  @Permissions(PERMISSIONS.SHIFT_EDIT)
  @Query(() => [VolunteerAllowance])
  async volunteerAllowanceStates(
    @Args('volunteerIds', { type: () => [ID] })
    volunteerIds: string[],
    @Args('shiftInstanceId', { type: () => ID, nullable: true })
    shiftInstanceId: string | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<VolunteerAllowance[]> {
    const organizationUnitId = context.organizationUnitId;
    // Accounting off means there are no allowance states to show, not an error
    // every list on the page would surface.
    let organizationId: string;
    try {
      organizationId =
        await this.accountingOrgAccessService.resolveEnabledOrganizationId(
          organizationUnitId,
        );
    } catch (error) {
      if (error instanceof ForbiddenGraphQLError) return [];
      throw error;
    }

    return this.volunteerAllowanceService.getVolunteerAllowanceStates({
      organizationId,
      organizationUnitId,
      volunteerIds,
      shiftInstanceId: shiftInstanceId ?? undefined,
    });
  }
}

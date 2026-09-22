import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import { UserProfile } from '../models/user-profile.model';
import { maskRestrictedPaymentData } from '../payment-visibility';
import { UserProfileService } from '../services';

@Resolver(() => UserProfile)
export class UserProfileQueryResolver {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly userProfileMapper: UserProfileMapper,
    private readonly authService: AuthService,
  ) {}

  @Query(() => UserProfile, { nullable: true })
  async myUserProfile(
    @Context() context: AuthenticatedGraphQLContext,
    @Session() session: UserSession,
  ): Promise<UserProfile | null> {
    const item = await this.userProfileService.findByUserId(session.user.id);
    return this.userProfileMapper.toModel(item);
  }

  @Permissions(PERMISSIONS.VOLUNTEER_VIEW)
  @Query(() => UserProfile, { nullable: true })
  async adminUserProfile(
    @Args('userId') userId: string,
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
  ): Promise<UserProfile | null> {
    const item = await this.userProfileService.findByUserIdInOrgUnit(
      userId,
      ctx.organizationUnitId,
    );
    if (!item) {
      return null;
    }

    const canSeePaymentData =
      session.user.id === userId ||
      (await this.authService.hasRequiredPermissions(
        session.user.id,
        ctx.organizationUnitId,
        [PERMISSIONS.ACCOUNTING_MANAGE],
      ));

    return this.userProfileMapper.toModel(
      canSeePaymentData
        ? item
        : { ...item, data: maskRestrictedPaymentData(item.data) },
    );
  }
}

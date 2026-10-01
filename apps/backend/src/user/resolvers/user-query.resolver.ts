import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { maskRestrictedPaymentUserFields } from '../../requirement-profile/payment-visibility';
import { UserWithProfileMapper } from '../mappers/user-with-profile.mapper';
import { User } from '../models/user.model';
import { UserWithProfile } from '../models/user-with-profile.model';
import { UserService } from '../user.service';

@Resolver(() => User)
export class UserQueryResolver {
  constructor(
    private readonly userService: UserService,
    private readonly userWithProfileMapper: UserWithProfileMapper,
    private readonly authService: AuthService,
  ) {}

  @Query(() => UserWithProfile)
  async me(@Session() session: UserSession): Promise<UserWithProfile> {
    const me = await this.userService.findByIdOrThrow(session.user.id);
    return this.userWithProfileMapper.toModelOrThrow(me);
  }

  @Permissions(PERMISSIONS.VOLUNTEER_VIEW)
  @Query(() => UserWithProfile, { nullable: true })
  async user(
    @Args('id') id: string,
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
  ): Promise<UserWithProfile | null> {
    const item = await this.userService.findByIdInOrgUnit(
      id,
      ctx.organizationUnitId,
    );
    if (!item) {
      return null;
    }

    const canSeePaymentData =
      session.user.id === id ||
      (await this.authService.hasRequiredPermissions(
        session.user.id,
        ctx.organizationUnitId,
        [PERMISSIONS.ACCOUNTING_MANAGE],
      ));

    return this.userWithProfileMapper.toModel(
      canSeePaymentData ? item : maskRestrictedPaymentUserFields(item),
    );
  }
}

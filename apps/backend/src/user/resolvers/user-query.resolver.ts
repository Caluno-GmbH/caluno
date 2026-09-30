import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthService } from '../../auth/auth.service';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { maskRestrictedPaymentUserFields } from '../../requirement-profile/payment-visibility';
import { UserMapper } from '../mappers/user.mapper';
import { User } from '../models/user.model';
import { UserService } from '../user.service';

@Resolver(() => User)
export class UserQueryResolver {
  constructor(
    private readonly userService: UserService,
    private readonly userMapper: UserMapper,
    private readonly authService: AuthService,
  ) {}

  @Query(() => User)
  async me(@Session() session: UserSession): Promise<User> {
    const me = await this.userService.findByIdOrThrow(session.user.id);
    return this.userMapper.toModelOrThrow(me);
  }

  @Permissions(PERMISSIONS.VOLUNTEER_VIEW)
  @Query(() => User, { nullable: true })
  async user(
    @Args('id') id: string,
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
  ): Promise<User | null> {
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

    return this.userMapper.toModel(
      canSeePaymentData ? item : maskRestrictedPaymentUserFields(item),
    );
  }

  @Permissions(PERMISSIONS.SHIFT_VIEW)
  @Query(() => User, { nullable: true })
  async userByCheckInId(
    @Args('checkInId') checkInId: string,
  ): Promise<User | null> {
    const user = await this.userService.findByCheckInId(checkInId);
    return this.userMapper.toModel(user);
  }
}

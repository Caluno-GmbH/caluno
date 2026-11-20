import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { GraphQLContext } from '../../graphql/graphql.context';
import { ChangeFeed } from '../models/change-feed.model';
import { ChangeFeedService } from '../services/change-feed.service';

/**
 * Session-only: no `@Permissions()`. Visibility is decided per area inside the
 * service, because a single query spans several areas with different
 * permission requirements.
 */
@Resolver()
export class ChangeFeedQueryResolver {
  constructor(private readonly changeFeedService: ChangeFeedService) {}

  @Query(() => ChangeFeed)
  changesSince(
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null | undefined,
    @Session() session: UserSession,
    @Context() context: GraphQLContext,
  ): Promise<ChangeFeed> {
    return this.changeFeedService.changesSince(
      session.user.id,
      context.organizationUnitId,
      cursor ?? null,
    );
  }
}

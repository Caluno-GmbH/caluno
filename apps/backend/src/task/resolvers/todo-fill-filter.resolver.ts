import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import {
  TodoFillAssignmentFilter,
  UpdateTodoFillAssignmentFilterInput,
} from '../models/todo-fill-filter.model';
import { TodoFillFilterService } from '../services/todo-fill-filter.service';

@Resolver(() => TodoFillAssignmentFilter)
export class TodoFillFilterResolver {
  constructor(private readonly filters: TodoFillFilterService) {}

  @Query(() => TodoFillAssignmentFilter)
  todoFillAssignmentFilter(
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
  ): Promise<TodoFillAssignmentFilter> {
    return this.filters.get(session.user.id, ctx.organizationUnitId);
  }

  @Permissions(PERMISSIONS.SHIFT_EDIT)
  @Mutation(() => TodoFillAssignmentFilter)
  updateTodoFillAssignmentFilter(
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
    @Args('input') input: UpdateTodoFillAssignmentFilterInput,
  ): Promise<TodoFillAssignmentFilter> {
    return this.filters.update(session.user.id, ctx.organizationUnitId, input);
  }
}

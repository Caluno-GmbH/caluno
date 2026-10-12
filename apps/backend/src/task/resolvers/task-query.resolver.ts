import { Context, Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { Task } from '../models/task.model';
import { TaskService } from '../services/task.service';

@Resolver(() => Task)
export class TaskQueryResolver {
  constructor(private readonly taskService: TaskService) {}

  @Query(() => [Task])
  myTasks(
    @Session() session: UserSession,
    @Context() ctx: AuthenticatedGraphQLContext,
  ): Task[] {
    return this.taskService.myTasks(session.user.id, ctx.organizationUnitId);
  }
}

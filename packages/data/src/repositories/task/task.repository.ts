import type {
  MyTasksQuery,
  TodoFillAssignmentFilterQuery,
  UpdateTodoFillAssignmentFilterMutation,
  UpdateTodoFillAssignmentFilterMutationVariables,
} from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class TaskRepository extends BaseRepository {
  async myTasks(): Promise<MyTasksQuery['myTasks']> {
    const data = await this.sdk.MyTasks();
    return data.myTasks;
  }

  async todoFillAssignmentFilter(): Promise<
    TodoFillAssignmentFilterQuery['todoFillAssignmentFilter']
  > {
    const data = await this.sdk.TodoFillAssignmentFilter();
    return data.todoFillAssignmentFilter;
  }

  async updateTodoFillAssignmentFilter(
    input: UpdateTodoFillAssignmentFilterMutationVariables['input'],
  ): Promise<
    UpdateTodoFillAssignmentFilterMutation['updateTodoFillAssignmentFilter']
  > {
    const data = await this.sdk.UpdateTodoFillAssignmentFilter({ input });
    return data.updateTodoFillAssignmentFilter;
  }
}

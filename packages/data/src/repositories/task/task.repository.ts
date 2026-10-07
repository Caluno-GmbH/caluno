import type { MyTasksQuery } from '../../generated/graphql';
import { BaseRepository } from '../base/base.repository';

export class TaskRepository extends BaseRepository {
  async myTasks(): Promise<MyTasksQuery['myTasks']> {
    const data = await this.sdk.MyTasks();
    return data.myTasks;
  }
}

import { Module } from '@nestjs/common';
import { TaskQueryResolver } from './resolvers/task-query.resolver';
import { TaskService } from './services/task.service';

@Module({
  providers: [TaskService, TaskQueryResolver],
  exports: [TaskService],
})
export class TaskModule {}

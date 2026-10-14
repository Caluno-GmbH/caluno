import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TaskQueryResolver } from './resolvers/task-query.resolver';
import { TodoFillFilterResolver } from './resolvers/todo-fill-filter.resolver';
import { TaskService } from './services/task.service';
import { TodoFillFilterService } from './services/todo-fill-filter.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [
    TaskService,
    TaskQueryResolver,
    TodoFillFilterService,
    TodoFillFilterResolver,
  ],
  exports: [TaskService],
})
export class TaskModule {}

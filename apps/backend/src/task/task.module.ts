import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TaskQueryResolver } from './resolvers/task-query.resolver';
import { TaskService } from './services/task.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [TaskService, TaskQueryResolver],
  exports: [TaskService],
})
export class TaskModule {}

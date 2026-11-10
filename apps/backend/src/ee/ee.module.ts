import { Module } from '@nestjs/common';
import { TaskModule } from './task/task.module';

/** Enterprise Edition aggregate — only loaded when `src/ee` is present. */
@Module({
  imports: [TaskModule],
})
export class EeModule {}

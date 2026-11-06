import { Module } from '@nestjs/common';

/** Enterprise Edition aggregate — only loaded when `src/ee` is present. */
@Module({
  imports: [],
})
export class EeModule {}

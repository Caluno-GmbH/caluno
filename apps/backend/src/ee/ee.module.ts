import { Module } from '@nestjs/common';
import { NoteModule } from './note/note.module';

/** Enterprise Edition aggregate — only loaded when `src/ee` is present. */
@Module({
  imports: [NoteModule],
})
export class EeModule {}

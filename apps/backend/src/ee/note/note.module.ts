import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UserNoteMapper } from './mappers/user-note.mapper';
import { UserNoteMutationResolver } from './resolvers/user-note-mutation.resolver';
import { UserNoteQueryResolver } from './resolvers/user-note-query.resolver';
import { UserNoteService } from './services/user-note.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    UserNoteService,
    UserNoteMapper,
    UserNoteQueryResolver,
    UserNoteMutationResolver,
  ],
})
export class NoteModule {}

import { Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserNoteMapper } from '../mappers/user-note.mapper';
import { UserNote } from '../models/user-note.model';
import { UserNoteService } from '../services/user-note.service';

@Resolver(() => UserNote)
export class UserNoteQueryResolver {
  constructor(
    private readonly userNoteService: UserNoteService,
    private readonly userNoteMapper: UserNoteMapper,
  ) {}

  @Query(() => UserNote)
  async myNote(@Session() session: UserSession): Promise<UserNote> {
    const note = await this.userNoteService.getForUser(session.user.id);
    return this.userNoteMapper.toModelOrThrow(note);
  }
}

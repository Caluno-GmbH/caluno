import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UpdateMyNoteInput } from '../inputs/update-my-note.input';
import { UserNoteMapper } from '../mappers/user-note.mapper';
import { UserNote } from '../models/user-note.model';
import { UserNoteService } from '../services/user-note.service';

@Resolver(() => UserNote)
export class UserNoteMutationResolver {
  constructor(
    private readonly userNoteService: UserNoteService,
    private readonly userNoteMapper: UserNoteMapper,
  ) {}

  @Mutation(() => UserNote)
  async updateMyNote(
    @Args('input') input: UpdateMyNoteInput,
    @Session() session: UserSession,
  ): Promise<UserNote> {
    const note = await this.userNoteService.updateForUser(
      session.user.id,
      input.body,
    );
    return this.userNoteMapper.toModelOrThrow(note);
  }
}

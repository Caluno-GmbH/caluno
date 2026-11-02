import type { UpdateMyNoteInput } from '../../generated/base-types';
import type {
  MyNoteQuery,
  UpdateMyNoteMutation,
} from '../../generated/graphql';
import { BaseRepository } from '../../repositories/base/base.repository';

export class NoteRepository extends BaseRepository {
  async getMyNote(): Promise<MyNoteQuery['myNote']> {
    const data = await this.sdk.MyNote();
    return data.myNote;
  }

  async updateMyNote(
    input: UpdateMyNoteInput,
  ): Promise<UpdateMyNoteMutation['updateMyNote']> {
    const data = await this.sdk.UpdateMyNote({ input });
    return data.updateMyNote;
  }
}

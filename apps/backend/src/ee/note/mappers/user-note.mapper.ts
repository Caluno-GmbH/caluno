import { Mapper } from '../../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../../shared/mapper';
import { UserNote } from '../models/user-note.model';
import type { UserNoteEntity } from '../schemas/user-note.schema';

@Mapper({ model: UserNote })
export class UserNoteMapper extends BaseMapper<UserNote, UserNoteEntity> {}

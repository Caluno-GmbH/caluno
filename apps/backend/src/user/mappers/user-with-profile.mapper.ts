import type { UserEntity } from '../../auth/schemas/auth.schema';
import { Mapper } from '../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../shared/mapper';
import { UserWithProfile } from '../models/user-with-profile.model';

@Mapper({ model: UserWithProfile })
export class UserWithProfileMapper extends BaseMapper<
  UserWithProfile,
  UserEntity
> {}

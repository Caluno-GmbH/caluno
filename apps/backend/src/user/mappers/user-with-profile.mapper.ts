import type { UserEntity } from '../../auth/schemas/auth.schema';
import { Mapper } from '../../shared/decorators/mapper.decorator';
import { BaseMapper } from '../../shared/mapper';
import { UserWithPaymentProfile } from '../models/user-with-payment-profile.model';

@Mapper({ model: UserWithPaymentProfile })
export class UserWithProfileMapper extends BaseMapper<
  UserWithPaymentProfile,
  UserEntity
> {}

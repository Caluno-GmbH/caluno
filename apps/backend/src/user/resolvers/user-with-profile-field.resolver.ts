import { Resolver } from '@nestjs/graphql';
import { UserWithPaymentProfile } from '../models/user-with-payment-profile.model';
import { UserFieldResolver } from './user-field.resolver';

@Resolver(() => UserWithPaymentProfile)
export class UserWithProfileFieldResolver extends UserFieldResolver {}

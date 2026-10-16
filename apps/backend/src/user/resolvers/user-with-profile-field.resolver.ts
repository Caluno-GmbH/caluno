import { Resolver } from '@nestjs/graphql';
import { UserWithProfile } from '../models/user-with-profile.model';
import { UserFieldResolver } from './user-field.resolver';

@Resolver(() => UserWithProfile)
export class UserWithProfileFieldResolver extends UserFieldResolver {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { UserMapper } from './mappers/user.mapper';
import { UserWithProfileMapper } from './mappers/user-with-profile.mapper';
import { UserFieldResolver } from './resolvers/user-field.resolver';
import { UserMutationResolver } from './resolvers/user-mutation.resolver';
import { UserQueryResolver } from './resolvers/user-query.resolver';
import { UserWithProfileFieldResolver } from './resolvers/user-with-profile-field.resolver';
import { UserService } from './user.service';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  providers: [
    UserService,
    UserQueryResolver,
    UserMutationResolver,
    UserFieldResolver,
    UserWithProfileFieldResolver,
    UserMapper,
    UserWithProfileMapper,
  ],
  exports: [UserService, UserMapper],
})
export class UserModule {}

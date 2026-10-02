import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.model';

@ObjectType()
export class UserWithProfile extends User {
  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  street?: string | null;

  @Field(() => String, { nullable: true })
  zip?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  birthdate?: string | null;

  @Field(() => String, { nullable: true })
  iban?: string | null;

  @Field(() => String, { nullable: true })
  accountHolder?: string | null;

  @Field(() => String, { nullable: true })
  bic?: string | null;
}

import { Field, ObjectType } from '@nestjs/graphql';
import { UserWithProfile } from './user-with-profile.model';

@ObjectType()
export class UserWithPaymentProfile extends UserWithProfile {
  @Field(() => String, { nullable: true })
  iban?: string | null;

  @Field(() => String, { nullable: true })
  accountHolder?: string | null;

  @Field(() => String, { nullable: true })
  bic?: string | null;
}

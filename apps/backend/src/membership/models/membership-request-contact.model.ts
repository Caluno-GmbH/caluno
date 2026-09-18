import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MembershipRequestContact {
  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;
}

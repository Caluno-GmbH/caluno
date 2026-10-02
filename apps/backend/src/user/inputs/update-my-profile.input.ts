import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateMyProfileInput {
  @Field(() => String, { nullable: true })
  firstname?: string | null;

  @Field(() => String, { nullable: true })
  lastname?: string | null;

  @Field(() => String, { nullable: true })
  preferredName?: string | null;

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

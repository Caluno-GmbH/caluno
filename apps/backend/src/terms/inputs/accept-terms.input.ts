import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AcceptTermsInput {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  language!: string;
}

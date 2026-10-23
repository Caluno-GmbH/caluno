import { Field, InputType } from '@nestjs/graphql';
import { FormBlockRefInput } from './form-block-ref.input';

@InputType()
export class UpdateRequirementFormInput {
  @Field(() => String, { nullable: true })
  name?: string | null;

  // Nullable in DB — null clears the value
  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => [FormBlockRefInput], { nullable: true })
  blockRefs?: FormBlockRefInput[] | null;
}

import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FormSubmissionValuePrefill {
  @Field(() => ID)
  fieldId!: string;

  @Field(() => String)
  value!: string;
}

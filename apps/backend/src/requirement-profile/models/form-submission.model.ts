import { Field, ID, ObjectType } from '@nestjs/graphql';
import { createPaginatedResponseType } from '../../graphql/paginated-response.model';
import { User } from '../../user/models/user.model';

import { FormSubmissionValue } from './form-submission-value.model';
import { RequirementForm } from './requirement-form.model';

@ObjectType()
export class FormSubmission {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  formId!: string;

  @Field(() => String)
  userId!: string;

  @Field(() => String)
  organizationUnitId!: string;

  @Field(() => Date)
  submittedAt!: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [FormSubmissionValue], { nullable: true })
  values?: FormSubmissionValue[] | null;

  @Field(() => RequirementForm)
  form!: RequirementForm;

  @Field(() => User)
  user!: User;
}

export const FormSubmissionPaginatedResponse =
  createPaginatedResponseType<FormSubmission>(FormSubmission, 'FormSubmission');

export type FormSubmissionPaginatedResponse = InstanceType<
  typeof FormSubmissionPaginatedResponse
>;

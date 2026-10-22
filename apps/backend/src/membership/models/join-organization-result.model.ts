import { Field, ID, ObjectType } from '@nestjs/graphql';
import { JoinStatus } from '../../shared/enums/join-status.enum';
import { RequiredFormWithStatus } from './required-form-with-status.model';

@ObjectType()
export class JoinOrganizationResult {
  @Field(() => JoinStatus)
  status!: JoinStatus;

  @Field(() => ID, { nullable: true })
  membershipRequestId?: string | null;

  @Field(() => [RequiredFormWithStatus], { nullable: true })
  requiredForms?: RequiredFormWithStatus[] | null;
}

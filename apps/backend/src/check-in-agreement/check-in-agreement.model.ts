import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AgreementStatus } from './agreement-status.enum';

@ObjectType()
export class CheckInAgreement {
  @Field(() => AgreementStatus)
  status!: AgreementStatus;

  @Field(() => String, { nullable: true })
  reimbursementTypeName!: string | null;

  @Field(() => ID, { nullable: true })
  contractId!: string | null;

  @Field(() => Boolean)
  canManageAgreements!: boolean;

  @Field(() => [String])
  managerNames!: string[];
}

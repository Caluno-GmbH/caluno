import { Field, ID, InputType } from '@nestjs/graphql';
import { ContractStatus, ReimbursementTypeKey } from '../enums';

@InputType()
export class ContractFilterInput {
  @Field(() => ID, { nullable: true })
  volunteerId?: string | null;

  @Field(() => ID, { nullable: true })
  reimbursementTypeId?: ReimbursementTypeKey | null;

  @Field(() => ContractStatus, { nullable: true })
  status?: ContractStatus | null;

  @Field(() => Date, { nullable: true })
  periodStart?: Date | null;

  @Field(() => Date, { nullable: true })
  periodEnd?: Date | null;
}

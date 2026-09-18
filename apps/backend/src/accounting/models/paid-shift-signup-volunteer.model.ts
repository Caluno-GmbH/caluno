import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../user/models/user.model';
import { ReimbursementType } from './reimbursement-type.model';

@ObjectType()
export class PaidShiftSignupVolunteer {
  @Field(() => User)
  volunteer!: User;

  @Field(() => ReimbursementType)
  reimbursementType!: ReimbursementType;

  /** The uncovered month's Berlin bounds — the period the contract task covers. */
  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;
}

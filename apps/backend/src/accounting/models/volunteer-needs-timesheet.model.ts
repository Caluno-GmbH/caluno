import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../../user/models/user.model';
import { ReimbursementType } from './reimbursement-type.model';

/** A timesheet still to be created: a volunteer's unclaimed hours for one type in one Berlin month. */
@ObjectType()
export class VolunteerNeedsTimesheet {
  @Field(() => User)
  volunteer!: User;

  @Field(() => ReimbursementType)
  reimbursementType!: ReimbursementType;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => Float)
  eligibleHours!: number;

  @Field(() => Int)
  estimatedAmountCents!: number;
}

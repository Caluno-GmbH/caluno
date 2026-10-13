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

  /** Any hour of this month has no non-declined contract: a contract reminder is due. */
  @Field(() => Boolean)
  hasUncoveredHours!: boolean;

  /** `startedAt` of the earliest hour of this month with no non-declined contract, or null. */
  @Field(() => Date, { nullable: true })
  firstUncoveredAt?: Date | null;

  /** Any hour of this month has no ACTIVE contract: a timesheet issued now would be non-compliant. Not the same as `hasUncoveredHours`, which also counts drafts and contracts awaiting signature as cover. */
  @Field(() => Boolean)
  hasHoursWithoutActiveContract!: boolean;
}

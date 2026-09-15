import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { ReimbursementType } from './reimbursement-type.model';

@ObjectType()
export class EffectiveRate {
  @Field(() => ReimbursementType)
  reimbursementType!: ReimbursementType;

  @Field(() => Int)
  hourlyRateCents!: number;

  @Field(() => Boolean)
  isOverride!: boolean;

  /** What this unit would fall back to if it set no rate of its own. */
  @Field(() => Int)
  inheritedRateCents!: number;

  @Field(() => ID, { nullable: true })
  organizationUnitId?: string | null;
}

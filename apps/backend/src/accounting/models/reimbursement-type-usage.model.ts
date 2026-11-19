import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ReimbursementTypeKey } from '../enums';
import { ReimbursementType } from './reimbursement-type.model';

@ObjectType()
export class ReimbursementTypeUsage {
  @Field(() => ReimbursementTypeKey)
  reimbursementTypeKey!: ReimbursementTypeKey;

  @Field(() => ReimbursementType)
  reimbursementType!: ReimbursementType;

  @Field(() => Int)
  usedCents!: number;

  @Field(() => Int)
  limitCents!: number;

  @Field(() => Int)
  remainingCents!: number;
}

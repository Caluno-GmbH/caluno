import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ReimbursementTypeKey } from '../enums';

@ObjectType()
export class ReimbursementType {
  @Field(() => ReimbursementTypeKey)
  key!: ReimbursementTypeKey;

  @Field(() => String)
  legalReference!: string;

  @Field(() => Int)
  yearlyLimitCents!: number;

  @Field(() => Int)
  platformDefaultRateCents!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date | null;
}

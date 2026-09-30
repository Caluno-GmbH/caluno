import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ShiftInstanceDayCount {
  @Field(() => Date)
  date!: Date;

  @Field(() => Int)
  count!: number;
}

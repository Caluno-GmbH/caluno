import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { ChangeArea } from '../enums';

@ObjectType()
export class ChangeFeedEntry {
  @Field(() => ID)
  id!: string;

  @Field(() => ChangeArea)
  area!: ChangeArea;
}

@ObjectType()
export class ChangeFeed {
  @Field(() => String)
  cursor!: string;

  @Field(() => [ChangeFeedEntry])
  changes!: ChangeFeedEntry[];

  @Field(() => Boolean)
  reset!: boolean;

  @Field(() => Int, { nullable: true })
  pollAfterMs?: number | null;
}

import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ChangeArea } from '../change-area';

// Registered here (not in a separate enums barrel) so the enum is available as
// soon as the model module is loaded, mirroring the area-specific ownership of
// this slice.
registerEnumType(ChangeArea, {
  name: 'ChangeArea',
});

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

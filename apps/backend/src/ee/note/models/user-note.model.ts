import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserNote {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  body!: string;

  @Field(() => Date)
  updatedAt!: Date;
}

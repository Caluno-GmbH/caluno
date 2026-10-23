import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrganizationUserProfile {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  note?: string | null;
}

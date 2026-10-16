import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TermsStatus {
  @Field(() => Boolean)
  mustAccept!: boolean;

  @Field(() => String, { nullable: true })
  currentVersion!: string | null;

  @Field(() => String, { nullable: true })
  currentClass!: string | null;

  @Field(() => String, { nullable: true })
  acceptedVersion!: string | null;

  @Field(() => Date, { nullable: true })
  acceptedAt!: Date | null;
}

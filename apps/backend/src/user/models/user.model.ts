import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Permission } from '../../auth/models/permission.model';

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => ID)
  checkInId!: string;

  @Field(() => String, { nullable: true })
  locale?: string | null;

  @Field(() => Boolean, {
    description: 'Whether the volunteer receives the weekly plan email.',
  })
  emailWeeklyUpdateEnabled!: boolean;

  @Field(() => Boolean, {
    description: 'Whether the volunteer receives urgent call-out emails.',
  })
  emailUrgentCallsEnabled!: boolean;

  @Field(() => Boolean, {
    description:
      'Whether the volunteer receives platform emails (invitations, joining, cancellations, shift changes, membership).',
  })
  emailPlatformEnabled!: boolean;

  @Field(() => String, { nullable: true })
  firstname?: string | null;

  @Field(() => String, { nullable: true })
  lastname?: string | null;

  @Field(() => String, { nullable: true })
  preferredName?: string | null;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  street?: string | null;

  @Field(() => String, { nullable: true })
  zip?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  birthdate?: string | null;

  @Field(() => String, { nullable: true })
  iban?: string | null;

  @Field(() => String, { nullable: true })
  accountHolder?: string | null;

  @Field(() => String, { nullable: true })
  bic?: string | null;

  @Field(() => [Permission], { nullable: true })
  permissions?: Permission[] | null;
}

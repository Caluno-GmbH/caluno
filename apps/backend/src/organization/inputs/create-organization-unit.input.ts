import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateOrganizationUnitInput {
  @Field(() => String)
  organizationId!: string;

  @Field(() => String)
  parentId!: string;

  @Field(() => String)
  typeId!: string;

  @Field(() => String)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => String, { nullable: true })
  logoFileId?: string | null;

  @Field(() => String, { nullable: true })
  websiteUrl?: string | null;

  @Field(() => String, { nullable: true })
  contactEmail?: string | null;

  @Field(() => String, { nullable: true })
  contactPersonName?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  welcomeMessage?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  street?: string | null;

  @Field(() => String, { nullable: true })
  zipCode?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  legalRep?: string | null;
}

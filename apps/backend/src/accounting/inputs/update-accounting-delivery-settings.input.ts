import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { BundleDeliveryMethod } from '../enums';
import { MAX_BUNDLE_SUBJECT_LENGTH } from '../utils/bundle-email-subject';

/** Null (or blank) clears the unit's own value, so it inherits again. */
@InputType()
export class UpdateAccountingDeliverySettingsInput {
  @Field(() => BundleDeliveryMethod, { nullable: true })
  @IsOptional()
  @IsEnum(BundleDeliveryMethod)
  deliveryMethod?: BundleDeliveryMethod | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  recipientEmail?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(MAX_BUNDLE_SUBJECT_LENGTH)
  emailSubject?: string | null;
}

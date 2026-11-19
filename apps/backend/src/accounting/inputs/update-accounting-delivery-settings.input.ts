import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { BundleDeliveryMethod } from '../enums';
import { MAX_BUNDLE_SUBJECT_LENGTH } from '../utils/bundle-email-subject';

/**
 * Null or a whitespace-only string clears the unit's own value, so it inherits
 * again. An exactly empty string is stored as a deliberate empty value.
 */
@InputType()
export class UpdateAccountingDeliverySettingsInput {
  @Field(() => BundleDeliveryMethod, { nullable: true })
  @IsOptional()
  @IsEnum(BundleDeliveryMethod)
  deliveryMethod?: BundleDeliveryMethod | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((input) => (input.recipientEmail?.trim() ?? '') !== '')
  @IsEmail()
  @MaxLength(254)
  recipientEmail?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(MAX_BUNDLE_SUBJECT_LENGTH)
  emailSubject?: string | null;
}

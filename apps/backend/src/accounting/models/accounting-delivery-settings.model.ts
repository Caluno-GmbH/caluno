import { Field, ObjectType } from '@nestjs/graphql';
import { AccountingSettingSourceKind, BundleDeliveryMethod } from '../enums';

@ObjectType()
export class AccountingSettingSource {
  @Field(() => AccountingSettingSourceKind)
  kind!: AccountingSettingSourceKind;

  /** INHERITED only: the unit the value is inherited from. */
  @Field(() => String, { nullable: true })
  sourceName?: string | null;
}

/**
 * The delivery settings a unit uses, each field resolved on its own up the
 * ancestor chain, next to the values the unit set itself (null = inherit).
 */
@ObjectType()
export class AccountingDeliverySettings {
  @Field(() => BundleDeliveryMethod)
  deliveryMethod!: BundleDeliveryMethod;

  @Field(() => AccountingSettingSource)
  deliveryMethodSource!: AccountingSettingSource;

  @Field(() => String, { nullable: true })
  recipientEmail?: string | null;

  @Field(() => AccountingSettingSource)
  recipientEmailSource!: AccountingSettingSource;

  @Field(() => String)
  emailSubject!: string;

  @Field(() => AccountingSettingSource)
  emailSubjectSource!: AccountingSettingSource;

  @Field(() => BundleDeliveryMethod, { nullable: true })
  ownDeliveryMethod?: BundleDeliveryMethod | null;

  @Field(() => String, { nullable: true })
  ownRecipientEmail?: string | null;

  @Field(() => String, { nullable: true })
  ownEmailSubject?: string | null;

  /** What applies without the unit's own value: the nearest ancestor's, else the default. */
  @Field(() => BundleDeliveryMethod)
  inheritedDeliveryMethod!: BundleDeliveryMethod;

  @Field(() => String, { nullable: true })
  inheritedRecipientEmail?: string | null;

  @Field(() => String)
  inheritedEmailSubject!: string;

  /** The subject used when no unit in the chain sets one, in the caller's locale. */
  @Field(() => String)
  defaultEmailSubject!: string;
}

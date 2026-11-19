import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BundleDeliveryIssue } from '../enums';

@ObjectType()
export class BundleSendPreview {
  @Field(() => [BundleDeliveryIssue])
  issues!: BundleDeliveryIssue[];

  @Field(() => String, { nullable: true })
  recipientEmail?: string | null;

  @Field(() => String)
  subject!: string;

  @Field(() => Int)
  documentCount!: number;

  /** False when the bundle has more timesheets than one email may carry. */
  @Field(() => Boolean)
  fitsInEmail!: boolean;
}

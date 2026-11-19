import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmailDeliveryStatus } from '../../notification/email/outbox/email-outbox.enums';
import { User } from '../../user/models/user.model';
import {
  BundleDeliveryIssue,
  BundleDeliveryMethod,
  ReimbursementTypeKey,
} from '../enums';
import { ReimbursementType } from './reimbursement-type.model';

@ObjectType()
export class BundleDelivery {
  @Field(() => ID)
  id!: string;

  @Field(() => BundleDeliveryMethod)
  method!: BundleDeliveryMethod;

  @Field(() => User, { nullable: true })
  volunteer?: User | null;

  @Field(() => ReimbursementTypeKey, { nullable: true })
  reimbursementTypeKey?: ReimbursementTypeKey | null;

  @Field(() => ReimbursementType, { nullable: true })
  reimbursementType?: ReimbursementType | null;

  @Field(() => [ID])
  invoiceIds!: string[];

  @Field(() => String, { nullable: true })
  recipientEmail?: string | null;

  @Field(() => String, { nullable: true })
  subject?: string | null;

  @Field(() => [BundleDeliveryIssue])
  issues!: BundleDeliveryIssue[];

  @Field(() => EmailDeliveryStatus, { nullable: true })
  emailStatus?: EmailDeliveryStatus | null;

  @Field(() => User, { nullable: true })
  deliveredByUser?: User | null;

  @Field(() => Date)
  occurredAt!: Date;
}

@ObjectType()
export class InvoiceEmailDelivery {
  @Field(() => Date)
  occurredAt!: Date;

  @Field(() => User, { nullable: true })
  deliveredByUser?: User | null;

  @Field(() => EmailDeliveryStatus)
  status!: EmailDeliveryStatus;
}

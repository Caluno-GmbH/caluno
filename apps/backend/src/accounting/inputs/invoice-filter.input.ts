import { Field, ID, InputType } from '@nestjs/graphql';
import { InvoiceStatus, ReimbursementTypeKey } from '../enums';

@InputType()
export class InvoiceFilterInput {
  @Field(() => ID, { nullable: true })
  volunteerId?: string | null;

  @Field(() => ID, { nullable: true })
  reimbursementTypeId?: ReimbursementTypeKey | null;

  @Field(() => InvoiceStatus, { nullable: true })
  status?: InvoiceStatus | null;

  @Field(() => Date, { nullable: true })
  periodStart?: Date | null;

  @Field(() => Date, { nullable: true })
  periodEnd?: Date | null;
}

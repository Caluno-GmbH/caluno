import { Field, ID, InputType } from '@nestjs/graphql';
import { DocumentFieldOverrideInput } from './document-field-override.input';

@InputType()
export class CreateInvoiceInput {
  // Omit to resolve the org-wide default template; set to target a specific
  // unit's template override.
  @Field(() => ID, { nullable: true })
  organizationUnitId?: string | null;

  @Field(() => ID)
  volunteerId!: string;

  @Field(() => ID)
  reimbursementTypeId!: string;

  @Field(() => [ID])
  timeEntryIds!: string[];

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => [DocumentFieldOverrideInput], { nullable: true })
  fieldOverrides?: DocumentFieldOverrideInput[] | null;

  // Set when completing an auto-drafted invoice: the draft is promoted in
  // place instead of creating a second invoice for the same hours.
  @Field(() => ID, { nullable: true })
  draftInvoiceId?: string | null;
}

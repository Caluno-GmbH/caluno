import { Field, ID, InputType, Int } from '@nestjs/graphql';
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

  // The rate to pay on this one timesheet, when it differs from what the
  // organisation pays for this Pauschale. Omit to use the organisation's own
  // rate; setting it here never changes that rate for anyone else.
  @Field(() => Int, { nullable: true })
  hourlyRateCents?: number | null;

  @Field(() => [DocumentFieldOverrideInput], { nullable: true })
  fieldOverrides?: DocumentFieldOverrideInput[] | null;
}

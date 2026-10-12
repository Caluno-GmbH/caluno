import { Field, ID, InputType } from '@nestjs/graphql';
import { DocumentFieldOverrideInput } from './document-field-override.input';

@InputType()
export class CreateContractInput {
  // Omit to resolve the org-wide default template; set to target a specific
  // unit's template override.
  @Field(() => ID, { nullable: true })
  organizationUnitId?: string | null;

  // The auto-queued draft this contract is created from. It is always
  // consumed, even when the new period does not fully contain it; other drafts
  // are only superseded when the new period fully contains them.
  @Field(() => ID, { nullable: true })
  sourceDraftId?: string | null;

  @Field(() => ID)
  volunteerId!: string;

  @Field(() => ID)
  reimbursementTypeId!: string;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => [DocumentFieldOverrideInput], { nullable: true })
  fieldOverrides?: DocumentFieldOverrideInput[] | null;
}

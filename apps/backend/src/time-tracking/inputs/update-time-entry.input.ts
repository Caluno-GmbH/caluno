import { Field, InputType } from '@nestjs/graphql';
import { ReimbursementTypeKey } from '../../accounting/enums';

@InputType()
export class UpdateTimeEntryInput {
  @Field(() => String, { nullable: true })
  shiftInstanceId?: string | null;

  @Field(() => Date)
  startedAt!: Date;

  @Field(() => Date, { nullable: true })
  endedAt?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  // See AddTimeEntryInput.reimbursementTypeId — null clears paid status.
  @Field(() => String, { nullable: true })
  reimbursementTypeId?: ReimbursementTypeKey | null;
}

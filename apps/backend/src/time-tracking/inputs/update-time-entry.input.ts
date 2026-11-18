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

  // See AddTimeEntryInput.reimbursementTypeKey — null clears paid status.
  @Field(() => ReimbursementTypeKey, { nullable: true })
  reimbursementTypeKey?: ReimbursementTypeKey | null;
}

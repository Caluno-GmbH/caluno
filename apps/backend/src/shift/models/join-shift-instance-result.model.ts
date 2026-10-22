import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RequiredFormWithStatus } from '../../membership/models/required-form-with-status.model';
import { JoinStatus } from '../../shared/enums/join-status.enum';
import { ShiftInstance } from './shift-instance.model';

@ObjectType()
export class JoinShiftInstanceResult {
  @Field(() => JoinStatus)
  status!: JoinStatus;

  @Field(() => ShiftInstance)
  shiftInstance!: ShiftInstance;

  @Field(() => ID, { nullable: true })
  membershipRequestId?: string | null;

  @Field(() => [RequiredFormWithStatus], { nullable: true })
  requiredForms?: RequiredFormWithStatus[] | null;
}

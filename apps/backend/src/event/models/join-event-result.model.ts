import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RequiredFormWithStatus } from '../../membership/models/required-form-with-status.model';
import { JoinStatus } from '../../shared/enums/join-status.enum';
import { Event } from './event.model';

@ObjectType()
export class JoinEventResult {
  @Field(() => JoinStatus)
  status!: JoinStatus;

  @Field(() => Event)
  event!: Event;

  @Field(() => ID, { nullable: true })
  membershipRequestId?: string | null;

  @Field(() => [RequiredFormWithStatus], { nullable: true })
  requiredForms?: RequiredFormWithStatus[] | null;
}

import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ShiftInviteStatus } from '../../shift/enums';

@ObjectType()
export class CheckInReadiness {
  @Field(() => Boolean)
  isMember!: boolean;

  @Field(() => ID, { nullable: true })
  openMembershipRequestId?: string | null;

  @Field(() => ShiftInviteStatus, { nullable: true })
  shiftInviteStatus?: ShiftInviteStatus | null;

  @Field(() => Boolean)
  isParticipating!: boolean;

  @Field(() => Boolean)
  hasOpenTimeEntry!: boolean;

  @Field(() => Boolean)
  idVerificationEnabled!: boolean;

  @Field(() => Boolean)
  idVerified!: boolean;

  @Field(() => ID, { nullable: true })
  membershipId?: string | null;

  // Non-schema context fields: carried from the service for the
  // CheckInAgreementModule field resolver, which resolves `agreement`
  // independently so TimeTrackingModule does not depend on AccountingModule.
  volunteerId!: string;
  organizationUnitId!: string;
  shiftInstanceId!: string | null;
}

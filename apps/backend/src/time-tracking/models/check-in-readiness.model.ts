import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ShiftInviteStatus } from '../../shift/enums';

// The volunteer's open membership request to the selected unit or, failing
// that, its nearest ancestor that has one.
@ObjectType()
export class CheckInMembershipRequest {
  @Field(() => ID)
  id!: string;

  // Whether the caller may accept it: a check-in desk may only grant membership
  // in units it manages, and the request may target an ancestor.
  @Field(() => Boolean)
  canAccept!: boolean;

  // Name of the unit the request targets (the selected unit or an ancestor).
  @Field(() => String, { nullable: true })
  organizationUnitName?: string | null;
}

@ObjectType()
export class CheckInReadiness {
  @Field(() => Boolean)
  isMember!: boolean;

  @Field(() => CheckInMembershipRequest, { nullable: true })
  membershipRequest?: CheckInMembershipRequest | null;

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

  // Whether the caller may open the volunteer's profile (volunteer:view on the
  // unit) — check-in:manage alone does not grant it.
  @Field(() => Boolean)
  canViewVolunteerProfile!: boolean;

  // True without a shift or when the instance has no seat limit.
  @Field(() => Boolean)
  shiftHasAvailableSeat!: boolean;

  // Not in GraphQL schema — context for the CheckInAgreementModule field resolver
  // so TimeTrackingModule stays independent of AccountingModule.
  volunteerId!: string;
  organizationUnitId!: string;
  shiftInstanceId!: string | null;
}

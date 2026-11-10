import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ShiftInviteStatus } from '../../shift/enums';

@ObjectType()
export class CheckInReadiness {
  @Field(() => Boolean)
  isMember!: boolean;

  @Field(() => ID, { nullable: true })
  openMembershipRequestId?: string | null;

  // Whether the caller may accept the open request: a check-in desk may only
  // grant membership in units it manages, and the request may target an
  // ancestor of the selected unit. False when there is no open request.
  @Field(() => Boolean)
  canAcceptMembershipRequest!: boolean;

  // Name of the unit the open request targets (the selected unit or an
  // ancestor); null when there is no open request.
  @Field(() => String, { nullable: true })
  membershipRequestOrganizationUnitName?: string | null;

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

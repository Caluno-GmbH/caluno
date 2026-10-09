import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CheckInReadiness } from '../time-tracking/models/check-in-readiness.model';
import { CheckInAgreement } from './check-in-agreement.model';
import { AgreementStatusService } from './check-in-agreement.service';

@Resolver(() => CheckInReadiness)
export class CheckInReadinessAgreementResolver {
  constructor(
    private readonly agreementStatusService: AgreementStatusService,
  ) {}

  @ResolveField('agreement', () => CheckInAgreement)
  async agreement(
    @Parent() parent: CheckInReadiness,
    @Session() session: UserSession,
  ): Promise<CheckInAgreement> {
    return this.agreementStatusService.resolveAgreement({
      volunteerId: parent.volunteerId,
      organizationUnitId: parent.organizationUnitId,
      shiftInstanceId: parent.shiftInstanceId,
      callerUserId: session.user.id,
    });
  }
}

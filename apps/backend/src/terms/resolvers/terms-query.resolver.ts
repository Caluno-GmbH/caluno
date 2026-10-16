import { Query, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AllowUnacceptedTerms } from '../guards/allow-unaccepted-terms.decorator';
import { TermsStatus } from '../models/terms-status.model';
import { TermsService } from '../services/terms.service';

@Resolver(() => TermsStatus)
export class TermsQueryResolver {
  constructor(private readonly termsService: TermsService) {}

  @AllowUnacceptedTerms()
  @Query(() => TermsStatus)
  async termsStatus(@Session() session: UserSession): Promise<TermsStatus> {
    return this.termsService.getStatusForUser(session.user.id);
  }
}

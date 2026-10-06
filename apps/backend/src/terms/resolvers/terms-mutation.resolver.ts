import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AllowUnacceptedTerms } from '../guards/allow-unaccepted-terms.decorator';
import { AcceptTermsInput } from '../inputs/accept-terms.input';
import { TermsStatus } from '../models/terms-status.model';
import { TermsService } from '../services/terms.service';
import type { TermsLocale } from '../terms-files';

@Resolver(() => TermsStatus)
export class TermsMutationResolver {
  constructor(private readonly termsService: TermsService) {}

  @AllowUnacceptedTerms()
  @Mutation(() => TermsStatus)
  async acceptTerms(
    @Args('input') input: AcceptTermsInput,
    @Session() session: UserSession,
  ): Promise<TermsStatus> {
    await this.termsService.accept({
      userId: session.user.id,
      version: input.version,
      language: input.language as TermsLocale,
    });
    return this.termsService.getStatusForUser(session.user.id);
  }
}

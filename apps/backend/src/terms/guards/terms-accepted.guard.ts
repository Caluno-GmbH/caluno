import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Scope,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import { TermsService } from '../services/terms.service';
import { ALLOW_UNACCEPTED_TERMS_KEY } from './allow-unaccepted-terms.decorator';

@Injectable({ scope: Scope.REQUEST })
export class TermsAcceptedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly termsService: TermsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNACCEPTED_TERMS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    const { user, isHttp } = this.resolveRequestContext(context);
    if (!user) {
      return true;
    }

    const acceptedVersion =
      (user as { termsVersion?: string | null }).termsVersion ?? null;
    if (await this.termsService.mustAccept(acceptedVersion)) {
      const message =
        'You must accept the updated terms and conditions before continuing';
      if (isHttp) {
        throw new ForbiddenException(message);
      }
      throw new ForbiddenGraphQLError(message);
    }

    return true;
  }

  private resolveRequestContext(context: ExecutionContext): {
    user?: { id: string; termsVersion?: string | null };
    isHttp: boolean;
  } {
    if (context.getType() === 'http') {
      return { user: context.switchToHttp().getRequest().user, isHttp: true };
    }
    const gqlContext = GqlExecutionContext.create(context).getContext();
    return { user: gqlContext.req?.user, isHttp: false };
  }
}

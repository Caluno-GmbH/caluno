import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import { TermsService } from '../services/terms.service';
import { ALLOW_UNACCEPTED_TERMS_KEY } from './allow-unaccepted-terms.decorator';

@Injectable()
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
    const type = context.getType<GqlContextType>();
    if (type === 'http') {
      return { user: context.switchToHttp().getRequest().user, isHttp: true };
    }
    if (type === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext();
      return { user: gqlContext.req?.user, isHttp: false };
    }
    // Unknown execution context (e.g. rpc/ws): do not assume GraphQL.
    return { user: undefined, isHttp: false };
  }
}

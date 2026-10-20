import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { isExpectedGraphqlCode } from '@repo/observability';
import * as Sentry from '@sentry/nestjs';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { GraphQLError } from 'graphql';

/**
 * Reports unexpected exceptions to Sentry (HTTP + GraphQL contexts, via
 * SentryGlobalFilter) while keeping expected domain errors
 * (ForbiddenGraphQLError etc.) out of Sentry.
 *
 * SentryGlobalFilter treats every HttpException as expected, a 500 included,
 * so a REST route failing on the server would never reach Sentry. Those with a
 * 5xx status are reported here; a 4xx stays out.
 */
@Catch()
export class SentryExceptionFilter extends SentryGlobalFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (
      exception instanceof GraphQLError &&
      isExpectedGraphqlCode(exception.extensions?.code)
    ) {
      throw exception;
    }
    if (exception instanceof HttpException && exception.getStatus() >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}

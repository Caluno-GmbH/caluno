import type { ClientOptions } from '@sentry/core';
import { resolveSentryEnvironment } from './environments';
import { IGNORE_ERRORS } from './ignore-errors';
import { createTracesSampler } from './sampling';
import { scrubEvent } from './scrub';

export interface BaseOptionsInput {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRateOverride?: string;
}

/** The subset of Sentry options shared by both apps. */
export type SharedSentryOptions = Pick<
  ClientOptions,
  | 'dsn'
  | 'enabled'
  | 'environment'
  | 'release'
  | 'dataCollection'
  | 'ignoreErrors'
  | 'tracesSampler'
  | 'beforeSend'
  | 'beforeSendTransaction'
>;

export function buildBaseOptions(input: BaseOptionsInput): SharedSentryOptions {
  const environment = resolveSentryEnvironment(input.environment);
  return {
    dsn: input.dsn,
    // No DSN -> fully inert SDK (local dev stays Sentry-free).
    enabled: Boolean(input.dsn),
    environment,
    release: input.release,
    ignoreErrors: IGNORE_ERRORS,
    tracesSampler: createTracesSampler({
      environment,
      override: input.tracesSampleRateOverride,
    }),
    beforeSend: (event, _hint) => scrubEvent(event),
    beforeSendTransaction: (event, _hint) => scrubEvent(event),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
    },
  };
}

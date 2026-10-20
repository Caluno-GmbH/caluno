import { Injectable } from '@nestjs/common';
import type { Span } from '@sentry/nestjs';
import * as Sentry from '@sentry/nestjs';

// @sentry/nestjs re-exports the Span type but not StartSpanOptions
// (verified against @sentry/nestjs@10.70.0), so derive it from the SDK.
type StartSpanOptions = Parameters<typeof Sentry.startSpan>[0];

/** Tags (searchable in Sentry) and extra data attached to one captured error. */
export interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Thin DI wrapper around the Sentry SDK so services stay testable and
 * mockable. Import this service — never `@sentry/nestjs` — in domain code.
 */
@Injectable()
export class ObservabilityService {
  captureException(error: unknown, context?: CaptureContext): void {
    if (context) {
      Sentry.captureException(error, context);
    } else {
      Sentry.captureException(error);
    }
  }

  startSpan<T>(options: StartSpanOptions, callback: (span: Span) => T): T {
    return Sentry.startSpan(options, callback);
  }

  setUser(user: { id: string } | null): void {
    Sentry.setUser(user);
  }

  withIsolationScope<T>(callback: () => T): T {
    return Sentry.withIsolationScope(callback);
  }
}

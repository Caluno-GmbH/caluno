import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';
import {
  buildRequestErrorLogFields,
  isBenignRequestError,
} from './lib/request-error-log';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    const { logger } = await import('./lib/logger');
    logger.info('caluno-frontend server started with structured logging');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Dual-write request errors to Loki (pino stdout) and Sentry.
 * Infra HTTP metrics alone do not produce log lines — without this,
 * Cockpit 500s have no matching `caluno-frontend` Loki record.
 *
 * Skipped (expected control flow, not server failures):
 * - Client-aborted RSC streams (vercel/next.js#96704)
 * - Next redirect / notFound digests
 * - GraphQL UNAUTHENTICATED (login redirect via getDataClient onError)
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (isBenignRequestError(error)) {
    return;
  }

  // pino is Node-only; edge keeps Sentry-only reporting.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/logger');
    logger.error(
      buildRequestErrorLogFields(error, request, context),
      'request failed',
    );
  }

  Sentry.captureRequestError(error, request, context);
};

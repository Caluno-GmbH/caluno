import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';
import {
  buildRequestErrorLogFields,
  isBenignClientAbortError,
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
 * Client-aborted RSC streams are skipped (benign disconnects that Next
 * still forwards to onRequestError — vercel/next.js#96704).
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (isBenignClientAbortError(error)) {
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

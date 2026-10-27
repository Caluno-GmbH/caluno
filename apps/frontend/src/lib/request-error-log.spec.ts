import { describe, expect, it } from 'bun:test';
import { DataError } from '@repo/data';
import {
  buildRequestErrorLogFields,
  isBenignClientAbortError,
  isBenignRequestError,
  isNextControlFlowError,
  sanitizeRequestPath,
} from './request-error-log';

describe('isBenignClientAbortError', () => {
  it('matches the destination-stream-closed-early message', () => {
    expect(
      isBenignClientAbortError(
        new Error('The destination stream closed early.'),
      ),
    ).toBe(true);
  });

  it('matches AbortError and ResponseAborted by name', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isBenignClientAbortError(abort)).toBe(true);

    const responseAborted = new Error('response aborted');
    responseAborted.name = 'ResponseAborted';
    expect(isBenignClientAbortError(responseAborted)).toBe(true);
  });

  it('does not match genuine application errors', () => {
    expect(isBenignClientAbortError(new Error('boom'))).toBe(false);
    expect(isBenignClientAbortError('string')).toBe(false);
    expect(isBenignClientAbortError(null)).toBe(false);
  });
});

describe('isNextControlFlowError', () => {
  it('matches Next redirect / notFound digests', () => {
    expect(
      isNextControlFlowError(
        Object.assign(new Error('redirect'), {
          digest: 'NEXT_REDIRECT;replace;/login;307;',
        }),
      ),
    ).toBe(true);
    expect(
      isNextControlFlowError(
        Object.assign(new Error('not found'), { digest: 'NEXT_NOT_FOUND' }),
      ),
    ).toBe(true);
  });

  it('does not match hashed application digests', () => {
    expect(
      isNextControlFlowError(
        Object.assign(new Error('boom'), { digest: '366472912' }),
      ),
    ).toBe(false);
  });
});

describe('isBenignRequestError', () => {
  it('skips Next redirect digests (successful login redirect)', () => {
    expect(
      isBenignRequestError(
        Object.assign(new Error('redirect'), {
          digest: 'NEXT_REDIRECT;replace;/login;307;',
        }),
      ),
    ).toBe(true);
  });

  it('does not skip UNAUTHENTICATED DataErrors (redirect failed)', () => {
    expect(
      isBenignRequestError(
        new DataError('Unauthorized', { code: 'UNAUTHENTICATED' }),
      ),
    ).toBe(false);
  });

  it('does not skip other DataErrors', () => {
    expect(
      isBenignRequestError(new DataError('nope', { code: 'INTERNAL_ERROR' })),
    ).toBe(false);
  });
});

describe('sanitizeRequestPath', () => {
  it('returns the path unchanged when there is no query string', () => {
    expect(sanitizeRequestPath('/de/admin/orgs')).toBe('/de/admin/orgs');
  });

  it('strips the query string so tokens and codes never reach Loki', () => {
    expect(sanitizeRequestPath('/de/invite?token=secret&code=abc')).toBe(
      '/de/invite',
    );
  });
});

describe('buildRequestErrorLogFields', () => {
  it('builds a Loki-safe payload with sanitized path and route context', () => {
    const error = new Error('boom');
    const fields = buildRequestErrorLogFields(
      error,
      { method: 'GET', path: '/de/shifts?token=x' },
      {
        routerKind: 'App Router',
        routePath: '/[locale]/(public)/shifts/[shiftId]',
        routeType: 'render',
      },
    );

    expect(fields).toEqual({
      err: error,
      method: 'GET',
      path: '/de/shifts',
      routePath: '/[locale]/(public)/shifts/[shiftId]',
      routeType: 'render',
      routerKind: 'App Router',
    });
  });
});

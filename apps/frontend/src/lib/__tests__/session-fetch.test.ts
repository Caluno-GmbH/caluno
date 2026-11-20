import { afterEach, describe, expect, it, mock } from 'bun:test';
import { lookupSession } from '../session-fetch';

const originalFetch = globalThis.fetch;

const respondWith = (response: Response) => {
  globalThis.fetch = mock(async () => response) as unknown as typeof fetch;
};

const failWith = (error: Error) => {
  globalThis.fetch = mock(async () => {
    throw error;
  }) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('lookupSession', () => {
  it('returns the session', async () => {
    respondWith(Response.json({ user: { id: 'user-1' } }));

    expect(await lookupSession('token=t')).toEqual({
      state: 'signed-in',
      session: { user: { id: 'user-1' } },
    });
  });

  it('is signed out when the backend has no session for the cookie', async () => {
    respondWith(Response.json(null));

    expect(await lookupSession('token=t')).toEqual({ state: 'signed-out' });
  });

  it('is signed out when the session is rejected', async () => {
    respondWith(new Response(null, { status: 401 }));

    expect(await lookupSession('token=t')).toEqual({ state: 'signed-out' });
  });

  it('is unknown when rate-limited', async () => {
    respondWith(new Response(null, { status: 429 }));

    expect(await lookupSession('token=t')).toEqual({
      state: 'unknown',
      reason: 'status 429',
    });
  });

  it('is unknown when the backend fails', async () => {
    respondWith(new Response(null, { status: 503 }));

    expect(await lookupSession('token=t')).toEqual({
      state: 'unknown',
      reason: 'status 503',
    });
  });

  it('is unknown when the request times out', async () => {
    failWith(new DOMException('timed out', 'TimeoutError'));

    expect(await lookupSession('token=t')).toEqual({
      state: 'unknown',
      reason: 'TimeoutError',
    });
  });

  it('is unknown when the backend is unreachable', async () => {
    failWith(new TypeError('fetch failed'));

    expect(await lookupSession('token=t')).toEqual({
      state: 'unknown',
      reason: 'TypeError',
    });
  });

  it('passes a timeout signal', async () => {
    respondWith(Response.json(null));

    await lookupSession('token=t');

    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof mock>)
      .mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

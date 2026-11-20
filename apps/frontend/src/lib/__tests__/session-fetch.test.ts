import { afterEach, describe, expect, it, mock } from 'bun:test';
import { fetchSession } from '../session-fetch';

const originalFetch = globalThis.fetch;

const respondWith = (response: Response) => {
  globalThis.fetch = mock(async () => response) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchSession', () => {
  it('returns the session', async () => {
    respondWith(Response.json({ user: { id: 'user-1' } }));

    expect(await fetchSession('token=t')).toEqual({ user: { id: 'user-1' } });
  });

  it('returns null when the session is rejected', async () => {
    respondWith(new Response(null, { status: 401 }));

    expect(await fetchSession('token=t')).toBeNull();
  });

  it('throws when rate-limited instead of treating the user as signed out', async () => {
    respondWith(new Response(null, { status: 429 }));

    await expect(fetchSession('token=t')).rejects.toThrow('429');
  });

  it('throws when the backend fails', async () => {
    respondWith(new Response(null, { status: 503 }));

    await expect(fetchSession('token=t')).rejects.toThrow('503');
  });
});

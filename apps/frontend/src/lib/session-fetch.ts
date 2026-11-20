import { API_URL } from './constants';

const SESSION_TIMEOUT_MS = 5000;

// biome-ignore lint/suspicious/noExplicitAny: get-session's body is untyped, as before
type Session = any;

/**
 * `unknown` means the backend could not answer (timeout, network error, 429,
 * 5xx). Protected pages must not treat it as signed out: that logs users out
 * whenever the backend is under load.
 */
export type SessionLookup =
  | { state: 'signed-in'; session: Session }
  | { state: 'signed-out' }
  | { state: 'unknown'; reason: string };

export async function lookupSession(
  cookieHeader: string,
): Promise<SessionLookup> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
      },
      credentials: 'include',
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      state: 'unknown',
      reason: error instanceof Error ? error.name : 'fetch failed',
    };
  }

  if (response.status === 429 || response.status >= 500) {
    return { state: 'unknown', reason: `status ${response.status}` };
  }
  if (!response.ok) {
    return { state: 'signed-out' };
  }

  let session: Session;
  try {
    session = await response.json();
  } catch {
    return { state: 'unknown', reason: 'invalid response body' };
  }
  return session ? { state: 'signed-in', session } : { state: 'signed-out' };
}
